"""ONNX Whisper backend for CPU ASR inference."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

from services.asr.src.backend import missing_whisper_onnx_files, resolve_onnx_model_dir


class OnnxWhisperBackendError(RuntimeError):
    """Raised when the ONNX Whisper backend cannot be initialized or used."""


def _normalize_language_hint(language_hint: str | None) -> str | None:
    if not language_hint:
        return None
    normalized = language_hint.strip().lower()
    mapping = {
        "en": "english",
        "en-us": "english",
        "en-gb": "english",
        "english": "english",
        "zh": "chinese",
        "zh-cn": "chinese",
        "zh-tw": "chinese",
        "chinese": "chinese",
    }
    return mapping.get(normalized)


@lru_cache(maxsize=2)
def _load_onnx_pipeline(model_dir_raw: str):
    model_dir, missing = missing_whisper_onnx_files(model_dir_raw)
    if missing:
        raise OnnxWhisperBackendError(
            "Whisper ONNX model directory is incomplete: "
            f"{model_dir} missing {', '.join(missing)}"
        )

    try:
        from optimum.onnxruntime import ORTModelForSpeechSeq2Seq
        from transformers import AutoProcessor, pipeline
    except ModuleNotFoundError as exc:  # pragma: no cover - optional dependency
        raise OnnxWhisperBackendError(
            "ONNX Whisper backend requires `optimum`, `transformers`, and `onnxruntime`. "
            "Install the optional ASR ONNX dependencies first."
        ) from exc

    processor = AutoProcessor.from_pretrained(str(model_dir))
    model = ORTModelForSpeechSeq2Seq.from_pretrained(str(model_dir), provider="CPUExecutionProvider")

    return pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
    )


def transcribe_with_onnx_whisper(
    audio_path: str | Path,
    *,
    model_dir: str,
    language_hint: str | None = None,
) -> tuple[str, dict[str, Any]]:
    resolved_audio = Path(audio_path).expanduser().resolve()
    resolved_model_dir = resolve_onnx_model_dir(model_dir)
    asr_pipeline = _load_onnx_pipeline(str(resolved_model_dir))

    generate_kwargs = {"task": "transcribe"}
    normalized_language = _normalize_language_hint(language_hint)
    if normalized_language:
        generate_kwargs["language"] = normalized_language

    result = asr_pipeline(str(resolved_audio), generate_kwargs=generate_kwargs)
    transcript = ""
    if isinstance(result, dict):
        transcript = str(result.get("text", "")).strip()
    elif isinstance(result, str):
        transcript = result.strip()

    if not transcript:
        raise OnnxWhisperBackendError("ONNX Whisper backend returned an empty transcript.")

    metadata = {
        "backend": "onnx",
        "response_model": resolved_model_dir.name,
        "language": normalized_language or "",
    }
    return transcript, metadata
