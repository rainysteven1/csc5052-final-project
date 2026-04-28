from __future__ import annotations

import math
import wave
from pathlib import Path

import services.agent.src.backend.nodes.prosody_node as prosody_node_module
from services.agent.src.schemas.analysis import AudioMetadata, SpeechSegment
from services.agent.src.backend.nodes.prosody_node import analyze_prosody
from services.agent.src.backend.tools.feature_extractor import extract_segment_features
from services.agent.src.state import AnalysisState


class _FakeEnabledConfig:
    enabled = True


class _FakeProsodyClient:
    def __init__(self, config, *, config_path=None) -> None:
        self.provider = "fake"
        self.model = "fake-model"

    def chat_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        repair_schema_name: str | None = None,
        repair_schema_json: str | None = None,
    ):
        return {
            "interpretation": f"LLM::{system_prompt}",
            "coaching_hint": f"COACH::{user_prompt}",
            "feedback_focus": repair_schema_name or "",
        }


def _write_tone_wav(path: Path, *, sample_rate: int = 16000, duration_seconds: float = 2.0) -> None:
    frame_count = int(sample_rate * duration_seconds)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        frames = bytearray()
        for i in range(frame_count):
            amplitude = 12000 if i < frame_count // 2 else 4000
            sample = int(amplitude * math.sin(2 * math.pi * 220 * (i / sample_rate)))
            frames.extend(int(sample).to_bytes(2, byteorder="little", signed=True))
        handle.writeframes(bytes(frames))


def test_extract_segment_features_reads_wav_metrics(tmp_path: Path) -> None:
    audio_path = tmp_path / "tone.wav"
    _write_tone_wav(audio_path)
    segment = SpeechSegment(
        segment_id="seg_001",
        start=0.0,
        end=2.0,
        text="We will start now.",
        pause_before=0.6,
        token_count=4,
    )

    features = extract_segment_features(audio_path, segment)

    assert features["speech_rate"] == 2.0
    assert features["pause_duration"] == 0.6
    assert features["energy_var"] > 0


def test_prosody_agent_scores_long_pause_and_low_speech_rate(tmp_path: Path) -> None:
    audio_path = tmp_path / "tone.wav"
    _write_tone_wav(audio_path)

    state = AnalysisState(
        scenario="presentation",
        audio=AudioMetadata(source_path=str(audio_path), normalized_path=str(audio_path)),
        transcript="We start now.",
        segments=[
            SpeechSegment(
                segment_id="seg_001",
                start=0.0,
                end=2.0,
                text="We start now.",
                pause_before=0.8,
                token_count=3,
            )
        ],
    )

    result = analyze_prosody(state)

    assert len(result.agent_outputs.prosody) == 1
    output = result.agent_outputs.prosody[0]
    assert output.score and output.score > 0
    assert output.features["speech_rate"] == 1.5
    assert "句前停顿偏长" in " ".join(output.explanations)


def test_prosody_agent_reads_rules_from_custom_config(tmp_path: Path) -> None:
    audio_path = tmp_path / "tone.wav"
    _write_tone_wav(audio_path)

    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    (rules_dir / "prosody.toml").write_text(
        """
[speech_rate]
slow_threshold = 2.5
slow_weight = 0.4
slow_cap = 0.5
slow_explanation = "custom slow"
fast_threshold = 5.5
fast_weight = 0.2
fast_cap = 0.3
fast_explanation = "custom fast"

[pause]
threshold = 0.3
weight = 0.2
cap = 0.4
explanation = "custom pause"

[energy]
flat_threshold = 0.2
min_duration = 0.1
penalty = 0.15
explanation = "custom energy"

[pitch]
flat_threshold = 1.0
min_duration = 0.1
penalty = 0.16
explanation = "custom pitch"
""".strip(),
        encoding="utf-8",
    )
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[speaksure.rules]
prosody_rules = "rules/prosody.toml"
""".strip(),
        encoding="utf-8",
    )

    state = AnalysisState(
        scenario="presentation",
        audio=AudioMetadata(source_path=str(audio_path), normalized_path=str(audio_path)),
        transcript="We start now.",
        segments=[
            SpeechSegment(
                segment_id="seg_001",
                start=0.0,
                end=2.0,
                text="We start now.",
                pause_before=0.8,
                token_count=3,
            )
        ],
    )

    result = analyze_prosody(state, config_path=config_path)

    output = result.agent_outputs.prosody[0]
    assert output.score and output.score > 0
    assert "custom slow" in output.explanations
    assert "custom pause" in output.explanations


def test_prosody_agent_can_use_llm_interpretation_when_provider_is_hybrid(
    tmp_path: Path,
    monkeypatch,
) -> None:
    audio_path = tmp_path / "tone.wav"
    _write_tone_wav(audio_path)

    prompts_dir = tmp_path / "prompts"
    schemas_dir = prompts_dir / "schemas"
    prompts_dir.mkdir()
    schemas_dir.mkdir()
    (prompts_dir / "prosody_system.md").write_text("SYS::{scenario}::{payload_json}", encoding="utf-8")
    (prompts_dir / "prosody_user.md").write_text("USR::{payload_json}", encoding="utf-8")
    (schemas_dir / "prosody_result.json").write_text(
        '{"interpretation":"ok","coaching_hint":"ok","feedback_focus":"ok"}',
        encoding="utf-8",
    )
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[speaksure.runtime]
prosody_provider = "hybrid"

[speaksure.prompts]
prosody_system = "prompts/prosody_system.md"
prosody_user = "prompts/prosody_user.md"
prosody_repair_schema = "prompts/schemas/prosody_result.json"
""".strip(),
        encoding="utf-8",
    )

    monkeypatch.setattr(prosody_node_module, "resolve_runtime_llm_config", lambda: _FakeEnabledConfig())
    monkeypatch.setattr(prosody_node_module, "RuntimeLLMClient", _FakeProsodyClient)

    state = AnalysisState(
        scenario="presentation",
        audio=AudioMetadata(source_path=str(audio_path), normalized_path=str(audio_path)),
        transcript="We start now.",
        segments=[
            SpeechSegment(
                segment_id="seg_001",
                start=0.0,
                end=2.0,
                text="We start now.",
                pause_before=0.8,
                token_count=3,
            )
        ],
    )

    result = analyze_prosody(state, config_path=config_path)

    output = result.agent_outputs.prosody[0]
    assert output.interpretation and output.interpretation.startswith("LLM::SYS::presentation::")
    assert output.coaching_hint and output.coaching_hint.startswith("COACH::USR::")
    assert output.feedback_focus == "ProsodyResult"
    assert output.provider == "fake"
    assert output.model == "fake-model"
    assert any(item.startswith("LLM::SYS::presentation::") for item in output.explanations)
    assert result.meta["llm_prosody"]["seg_001"]["provider"] == "fake"
