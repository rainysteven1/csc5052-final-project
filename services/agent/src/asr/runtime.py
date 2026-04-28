"""ASR runtime for transcript lookup and remote transcription."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from services.agent.src.asr.backends import OnnxWhisperBackendError, transcribe_with_onnx_whisper
from services.agent.src.asr.config import missing_whisper_onnx_files, resolve_asr_backend_config
from services.agent.src.asr.language_detector import detect_runtime_language
from services.agent.src.asr.remote_api import RemoteAsrError, transcribe_with_remote_asr
from services.agent.src.asr.transports.grpc_client import transcribe_with_grpc_asr
from services.agent.src.language import normalize_runtime_language
from services.agent.src.schemas.analysis import SpeechSegment
from services.agent.src.services.artifact_loader import ArtifactBundle
from services.agent.src.state import AnalysisState


@dataclass
class AudioTranscription:
    transcript: str
    metadata: dict[str, Any]
    warnings: list[str]


def _fallback_transcript(audio_path: Path) -> str:
    stem = audio_path.stem.replace("_", " ").strip()
    if not stem:
        return "Transcript unavailable."
    return f"Transcript unavailable for {stem}."


def _candidate_manifest_paths(audio_path: Path, artifacts: ArtifactBundle) -> list[Path]:
    candidates: list[Path] = []
    configured_path = artifacts.metadata.paths.get("transcription_manifest_path")
    if configured_path:
        candidates.append(Path(configured_path).expanduser().resolve())

    candidates.extend(
        [
            audio_path.parent / "transcriptions.csv",
            audio_path.parent.parent / "transcriptions.csv",
            audio_path.parent.parent / "samples" / "transcriptions.csv",
        ]
    )

    unique_candidates: list[Path] = []
    seen: set[Path] = set()
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        unique_candidates.append(resolved)
    return unique_candidates


def _match_manifest_row(audio_path: Path, manifest_path: Path) -> dict[str, Any] | None:
    if not manifest_path.exists():
        return None

    audio_name = audio_path.name
    with manifest_path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            raw_audio_path = (row.get("audio_path") or "").strip()
            if not raw_audio_path:
                continue
            candidate = (manifest_path.parent / raw_audio_path).resolve()
            if candidate == audio_path.resolve() or Path(raw_audio_path).name == audio_name:
                return row
    return None


def _load_manifest_transcript(audio_path: Path, artifacts: ArtifactBundle) -> tuple[str | None, dict[str, Any]]:
    for manifest_path in _candidate_manifest_paths(audio_path, artifacts):
        row = _match_manifest_row(audio_path, manifest_path)
        if row is None:
            continue
        transcript = (row.get("transcription") or "").strip()
        if not transcript:
            continue
        metadata = {
            "manifest_path": str(manifest_path),
            "manifest_audio_path": row.get("audio_path", ""),
            "language": row.get("language", ""),
            "split": row.get("split", ""),
            "dataset_index": row.get("dataset_index", ""),
            "reference_text": row.get("reference_text", ""),
            "transcription_model": row.get("model", ""),
        }
        return transcript, metadata
    return None, {}


def transcribe_audio_file(
    audio_path: str | Path,
    *,
    scenario: str,
    provider: str = "local",
    api_url: str = "",
    language_hint: str | None = None,
    transcript_override: str | None = None,
) -> AudioTranscription:
    resolved_audio = Path(audio_path).expanduser().resolve()
    if not resolved_audio.exists():
        raise FileNotFoundError(f"Audio file not found for ASR service: {resolved_audio}")

    backend_config = resolve_asr_backend_config()
    metadata: dict[str, Any] = {
        "provider": provider,
        "backend": backend_config.backend,
    }
    warnings: list[str] = []

    if transcript_override and transcript_override.strip():
        return AudioTranscription(
            transcript=transcript_override.strip(),
            metadata={**metadata, "mode": "override"},
            warnings=warnings,
        )

    if provider == "api":
        transcript, remote_metadata = transcribe_with_remote_asr(
            resolved_audio,
            api_url=api_url,
            scenario=scenario,
            language_hint=language_hint,
        )
        return AudioTranscription(
            transcript=transcript,
            metadata={**metadata, **remote_metadata, "mode": "api"},
            warnings=warnings,
        )

    if provider not in {"local", "grpc", "stub"}:
        warnings.append(f"Unsupported ASR transport `{provider}`; using stub transcript fallback.")
        return AudioTranscription(
            transcript=_fallback_transcript(resolved_audio),
            metadata={**metadata, "mode": "stub"},
            warnings=warnings,
        )

    if backend_config.backend == "grpc":
        if not backend_config.grpc_target.strip():
            warnings.append(
                "ASR backend is configured as grpc, but `asr_backend_grpc_target` is empty; "
                "using stub transcript fallback."
            )
        else:
            transcript, remote_metadata = transcribe_with_grpc_asr(
                resolved_audio,
                grpc_target=backend_config.grpc_target,
                scenario=scenario,
                language_hint=language_hint,
            )
            return AudioTranscription(
                transcript=transcript,
                metadata={**metadata, **remote_metadata, "mode": provider, "backend": "grpc"},
                warnings=warnings,
            )
    elif backend_config.backend == "onnx":
        if not backend_config.onnx_model_dir.strip():
            warnings.append(
                "ASR backend is configured as onnx, but `asr_onnx_model_dir` is empty; "
                "using stub transcript fallback."
            )
        else:
            model_dir, missing = missing_whisper_onnx_files(backend_config.onnx_model_dir)
            metadata["onnx_model_dir"] = str(model_dir)
            if missing:
                warnings.append(
                    "ASR backend is configured as onnx, but model files are missing: "
                    f"{', '.join(missing)}; using stub transcript fallback."
                )
            else:
                try:
                    transcript, onnx_metadata = transcribe_with_onnx_whisper(
                        resolved_audio,
                        model_dir=backend_config.onnx_model_dir,
                        language_hint=language_hint,
                    )
                    return AudioTranscription(
                        transcript=transcript,
                        metadata={**metadata, **onnx_metadata, "mode": provider, "backend": "onnx"},
                        warnings=warnings,
                    )
                except OnnxWhisperBackendError as exc:
                    warnings.append(f"ONNX Whisper backend unavailable: {exc}; using stub transcript fallback.")
    else:
        warnings.append("ASR backend is using stub transcription fallback.")

    return AudioTranscription(
        transcript=_fallback_transcript(resolved_audio),
        metadata={**metadata, "mode": provider},
        warnings=warnings,
    )


def transcribe_audio(
    state: AnalysisState,
    artifacts: ArtifactBundle,
    transcript_override: str | None = None,
) -> AnalysisState:
    audio_path = Path(state.audio.normalized_path or state.audio.source_path).expanduser().resolve()
    if not audio_path.exists():
        raise FileNotFoundError(f"Normalized audio file not found: {audio_path}")

    provider = artifacts.metadata.providers.get("asr", "stub")
    transcript = ""
    if transcript_override:
        transcript = transcript_override.strip()
        state.meta["asr_mode"] = "override"
    else:
        sidecar_path = audio_path.with_suffix(".txt")
        if sidecar_path.exists():
            transcript = sidecar_path.read_text(encoding="utf-8").strip()
            state.meta["asr_mode"] = "sidecar"
        else:
            manifest_transcript, manifest_metadata = _load_manifest_transcript(audio_path, artifacts)
            if manifest_transcript:
                transcript = manifest_transcript
                state.meta["asr_mode"] = "manifest"
                state.meta["manifest"] = manifest_metadata
                if manifest_metadata.get("language"):
                    state.meta["language"] = normalize_runtime_language(manifest_metadata["language"]) or str(
                        manifest_metadata["language"]
                    ).strip().lower()
            else:
                language_hint = normalize_runtime_language(state.meta.get("language"))
                try:
                    if provider == "api":
                        transcription = transcribe_audio_file(
                            audio_path,
                            provider="api",
                            api_url=artifacts.metadata.paths.get("asr_api_url", ""),
                            scenario=state.scenario,
                            language_hint=str(language_hint) if language_hint else None,
                        )
                        state.meta["asr_mode"] = "api"
                        state.meta["asr_api"] = transcription.metadata
                    elif provider == "grpc":
                        transcript, remote_metadata = transcribe_with_grpc_asr(
                            audio_path,
                            grpc_target=artifacts.metadata.paths.get("asr_grpc_target", ""),
                            scenario=state.scenario,
                            language_hint=str(language_hint) if language_hint else None,
                        )
                        state.meta["asr_mode"] = "grpc"
                        state.meta["asr_grpc"] = remote_metadata
                        if remote_metadata.get("language"):
                            state.meta["language"] = normalize_runtime_language(remote_metadata["language"]) or str(
                                remote_metadata["language"]
                            ).strip().lower()
                        transcription = AudioTranscription(transcript=transcript, metadata=remote_metadata, warnings=[])
                    elif provider == "local":
                        transcription = transcribe_audio_file(
                            audio_path,
                            provider="local",
                            scenario=state.scenario,
                            language_hint=str(language_hint) if language_hint else None,
                        )
                        state.meta["asr_mode"] = "local"
                        state.meta["asr_local"] = transcription.metadata
                    else:
                        transcription = transcribe_audio_file(audio_path, provider="stub", scenario=state.scenario)
                        state.meta["asr_mode"] = "stub"

                    transcript = transcription.transcript
                    for warning in transcription.warnings:
                        state.add_warning(warning)
                    if transcription.metadata.get("language"):
                        state.meta["language"] = normalize_runtime_language(transcription.metadata["language"]) or str(
                            transcription.metadata["language"]
                        ).strip().lower()
                except RemoteAsrError as exc:
                    state.add_warning(f"Remote ASR unavailable: {exc}")
                    transcript = _fallback_transcript(audio_path)
                    state.meta["asr_mode"] = "stub"
                    state.add_warning("ASR transcript sources exhausted; using stub transcript fallback.")

    duration = state.audio.duration_seconds or 0.0
    state.transcript = transcript
    if not normalize_runtime_language(state.meta.get("language")) and transcript.strip():
        detection = detect_runtime_language(
            transcript,
            model_dir=artifacts.metadata.paths.get("language_detector_model_dir", ""),
        )
        detected_language = normalize_runtime_language(detection.get("language"))
        if detected_language:
            state.meta["language"] = detected_language
        state.meta["language_confidence"] = detection.get("confidence", 0.0)
        state.meta["language_source"] = detection.get("source", "unknown")
    elif normalize_runtime_language(state.meta.get("language")):
        state.meta["language"] = normalize_runtime_language(state.meta.get("language"))
        state.meta.setdefault("language_source", "upstream")
    state.artifacts = artifacts.metadata.model_copy(deep=True)
    state.raw_asr_segments = [
        SpeechSegment(
            segment_id="asr_001",
            start=0.0,
            end=duration,
            text=transcript,
            token_count=len(transcript.split()),
        )
    ]
    return state
