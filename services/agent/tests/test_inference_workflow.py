from __future__ import annotations

import json
import subprocess
import sys
import wave
from pathlib import Path

from services.agent.src.services.artifact_loader import load_artifacts
from services.agent.src.state import build_initial_state
from services.agent.src.workflow import build_inference_workflow
from services.asr.src import service as asr_service


def _write_silence_wav(path: Path, *, sample_rate: int = 16000, duration_seconds: float = 0.25) -> None:
    frame_count = int(sample_rate * duration_seconds)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        handle.writeframes(b"\x00\x00" * frame_count)


def test_inference_workflow_runs_with_sidecar_transcript(tmp_path: Path) -> None:
    audio_path = tmp_path / "interview_demo.wav"
    transcript_path = tmp_path / "interview_demo.txt"
    _write_silence_wav(audio_path)
    transcript_path.write_text(
        "I think we can start from the dataset. Um maybe begin with the baseline.",
        encoding="utf-8",
    )

    state = build_initial_state(audio_path=audio_path, scenario="interview")
    workflow = build_inference_workflow(artifacts=load_artifacts())
    result = workflow.invoke(state)

    assert result.status == "completed"
    assert result.meta["workflow_engine"] == "langgraph"
    assert result.transcript.startswith("I think")
    assert len(result.segments) >= 2
    assert result.result.segment_results
    assert result.agent_outputs.lexical
    assert result.agent_outputs.prosody
    assert result.agent_outputs.disfluency
    assert result.result.overall_score and result.result.overall_score > 0
    assert "lexical_uncertainty" in result.result.dominant_causes
    assert "disfluency" in result.result.dominant_causes
    assert result.agent_outputs.feedback[0].rewrite is not None
    assert result.agent_outputs.feedback[0].severity in {"low", "medium", "high"}
    assert result.agent_outputs.feedback[0].focus_tags
    assert result.agent_outputs.feedback[0].practice_steps


def test_inference_workflow_reads_transcription_manifest(tmp_path: Path) -> None:
    samples_dir = tmp_path / "samples"
    audio_dir = samples_dir / "audio"
    audio_dir.mkdir(parents=True)
    audio_path = audio_dir / "zh_test_0001.wav"
    manifest_path = samples_dir / "transcriptions.csv"

    _write_silence_wav(audio_path)
    manifest_path.write_text(
        (
            "audio_path,language,split,dataset_index,reference_text,transcription,model\n"
            "./audio/zh_test_0001.wav,zh,test,1,示例参考文本,这是来自 manifest 的转写结果,Whisper-large-v3\n"
        ),
        encoding="utf-8",
    )

    state = build_initial_state(audio_path=audio_path, scenario="interview")
    workflow = build_inference_workflow(artifacts=load_artifacts())
    result = workflow.invoke(state)

    assert result.transcript == "这是来自 manifest 的转写结果"
    assert result.meta["asr_mode"] == "manifest"
    assert result.meta["manifest"]["language"] == "zh"
    assert result.meta["manifest"]["transcription_model"] == "Whisper-large-v3"


def test_inference_workflow_handles_flac_content_with_wav_suffix(tmp_path: Path) -> None:
    samples_dir = tmp_path / "samples"
    audio_dir = samples_dir / "audio"
    audio_dir.mkdir(parents=True)
    audio_path = audio_dir / "en_test_fake.wav"
    manifest_path = samples_dir / "transcriptions.csv"

    audio_path.write_bytes(b"fLaC" + b"\x00" * 128)
    manifest_path.write_text(
        (
            "audio_path,language,split,dataset_index,reference_text,transcription,model\n"
            "./audio/en_test_fake.wav,en,test,99,REFERENCE TEXT,This transcript comes from manifest,Whisper-large-v3\n"
        ),
        encoding="utf-8",
    )

    state = build_initial_state(audio_path=audio_path, scenario="presentation")
    workflow = build_inference_workflow(artifacts=load_artifacts())
    result = workflow.invoke(state)

    assert result.status == "completed"
    assert result.audio.format == "flac"
    assert result.transcript == "This transcript comes from manifest"
    assert any("container looks like flac" in warning for warning in result.warnings)


def test_inference_workflow_uses_remote_asr_provider_when_configured(tmp_path: Path, monkeypatch) -> None:
    audio_path = tmp_path / "remote.wav"
    config_path = tmp_path / "runtime.toml"
    _write_silence_wav(audio_path)
    config_path.write_text(
        """
[speaksure.runtime]
asr_provider = "api"
asr_api_url = "http://127.0.0.1:8000/transcribe"
""".strip(),
        encoding="utf-8",
    )

    def _fake_remote_asr(audio_path_arg: Path, *, api_url: str, scenario: str, language_hint: str | None = None):
        assert Path(audio_path_arg).name == "remote.wav"
        assert api_url == "http://127.0.0.1:8000/transcribe"
        assert scenario == "business"
        assert language_hint is None
        return "Remote ASR transcript from teammate service.", {"provider": "api", "response_model": "teammate-v1"}

    monkeypatch.setattr(asr_service, "transcribe_with_remote_asr", _fake_remote_asr)

    state = build_initial_state(audio_path=audio_path, scenario="business")
    workflow = build_inference_workflow(artifacts=load_artifacts(config_path), config_path=str(config_path))
    result = workflow.invoke(state)

    assert result.status == "completed"
    assert result.meta["asr_mode"] == "api"
    assert result.meta["asr_api"]["response_model"] == "teammate-v1"
    assert result.transcript == "Remote ASR transcript from teammate service."
    assert result.meta["workflow_engine"] == "langgraph"


def test_analyze_cli_writes_json_output(tmp_path: Path) -> None:
    service_root = Path(__file__).resolve().parents[1]
    audio_path = tmp_path / "demo.wav"
    transcript_path = tmp_path / "demo.txt"
    output_path = tmp_path / "result.json"

    _write_silence_wav(audio_path)
    transcript_path.write_text("This is a test transcript for the analyze command.", encoding="utf-8")

    proc = subprocess.run(
        [
            sys.executable,
            str(service_root / "cli.py"),
            "analyze",
            "--audio",
            str(audio_path),
            "--scenario",
            "interview",
            "--output",
            str(output_path),
        ],
        check=True,
        capture_output=True,
        text=True,
        cwd=service_root,
    )

    assert "Analyze complete" in proc.stdout
    payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert payload["status"] == "completed"
    assert payload["transcript"] == "This is a test transcript for the analyze command."
    assert payload["segments"]


def test_analyze_samples_cli_exports_batch_outputs(tmp_path: Path) -> None:
    service_root = Path(__file__).resolve().parents[1]
    samples_dir = tmp_path / "samples"
    audio_dir = samples_dir / "audio"
    output_dir = tmp_path / "demo_outputs"
    summary_path = output_dir / "summary.md"
    manifest_path = samples_dir / "transcriptions.csv"

    audio_dir.mkdir(parents=True)
    _write_silence_wav(audio_dir / "en_test_0001.wav")
    _write_silence_wav(audio_dir / "zh_test_0002.wav")
    manifest_path.write_text(
        (
            "audio_path,language,split,dataset_index,reference_text,transcription,model\n"
            "./audio/en_test_0001.wav,en,test,1,REFERENCE,This is the first manifest transcript.,Whisper-large-v3\n"
            "./audio/zh_test_0002.wav,zh,test,2,参考文本,这是第二条 manifest 转写。,Whisper-large-v3\n"
        ),
        encoding="utf-8",
    )

    proc = subprocess.run(
        [
            sys.executable,
            str(service_root / "cli.py"),
            "analyze-samples",
            "--audio-dir",
            str(audio_dir),
            "--manifest",
            str(manifest_path),
            "--output-dir",
            str(output_dir),
            "--summary-file",
            str(summary_path),
            "--scenario",
            "presentation",
        ],
        check=True,
        capture_output=True,
        text=True,
        cwd=service_root,
    )

    assert "SpeakSure++ Analyze Samples" in proc.stdout
    assert summary_path.exists()

    en_payload = json.loads((output_dir / "en_test_0001.presentation.json").read_text(encoding="utf-8"))
    zh_payload = json.loads((output_dir / "zh_test_0002.presentation.json").read_text(encoding="utf-8"))
    summary_text = summary_path.read_text(encoding="utf-8")

    assert en_payload["meta"]["asr_mode"] == "manifest"
    assert zh_payload["meta"]["asr_mode"] == "manifest"
    assert "en_test_0001.wav" in summary_text
    assert "zh_test_0002.wav" in summary_text
    assert "presentation" in summary_text


def test_workflow_uses_custom_context_weights(tmp_path: Path) -> None:
    audio_path = tmp_path / "custom.wav"
    transcript_path = tmp_path / "custom.txt"
    config_path = tmp_path / "custom.toml"

    _write_silence_wav(audio_path)
    transcript_path.write_text("Um I think maybe we should start now.", encoding="utf-8")
    config_path.write_text(
        """
[speaksure.contexts.interview.weights]
lexical = 0.8
disfluency = 0.2

[speaksure.contexts.interview]
style_constraints = ["custom interview style"]
""".strip(),
        encoding="utf-8",
    )

    state = build_initial_state(audio_path=audio_path, scenario="interview")
    workflow = build_inference_workflow(artifacts=load_artifacts(config_path), config_path=str(config_path))
    result = workflow.invoke(state)

    assert result.agent_outputs.context.weights["lexical"] == 0.8
    assert result.agent_outputs.context.style_constraints == ["custom interview style"]
