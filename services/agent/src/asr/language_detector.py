"""Transcript-level language detection for runtime prompt and rule routing."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

from services.agent.src.config import service_root
from services.agent.src.language import normalize_runtime_language

DEFAULT_LANGUAGE_MODEL_DIR = (
    service_root() / "models" / "papluca__xlm-roberta-base-language-detection"
)


def _heuristic_language(transcript: str) -> tuple[str | None, float]:
    text = transcript.strip()
    if not text:
        return None, 0.0

    chinese_count = sum(1 for char in text if "\u4e00" <= char <= "\u9fff")
    ascii_alpha_count = sum(1 for char in text if char.isascii() and char.isalpha())
    total_signal = chinese_count + ascii_alpha_count
    if total_signal == 0:
        return None, 0.0

    chinese_ratio = chinese_count / total_signal
    english_ratio = ascii_alpha_count / total_signal

    if chinese_ratio >= 0.30:
        return "zh", round(chinese_ratio, 3)
    if english_ratio >= 0.60:
        return "en", round(english_ratio, 3)
    return None, round(max(chinese_ratio, english_ratio), 3)


@lru_cache(maxsize=2)
def _load_text_classifier(model_dir_raw: str):
    resolved_dir = Path(model_dir_raw).expanduser().resolve()
    if not resolved_dir.exists():
        raise FileNotFoundError(f"Language detector model directory not found: {resolved_dir}")

    try:
        from transformers import pipeline
    except ModuleNotFoundError as exc:  # pragma: no cover - optional dependency
        raise RuntimeError("Language detector requires `transformers` and its runtime dependencies.") from exc

    return pipeline("text-classification", model=str(resolved_dir), tokenizer=str(resolved_dir))


def detect_runtime_language(
    transcript: str,
    *,
    model_dir: str | Path | None = None,
) -> dict[str, Any]:
    text = transcript.strip()
    if not text:
        return {"language": "", "confidence": 0.0, "source": "empty"}

    heuristic_language, heuristic_confidence = _heuristic_language(text)
    selected_model_dir = (
        Path(model_dir).expanduser().resolve() if model_dir not in {None, ""} else DEFAULT_LANGUAGE_MODEL_DIR
    )

    if selected_model_dir.exists():
        try:
            classifier = _load_text_classifier(str(selected_model_dir))
            result = classifier(text[:512], truncation=True)
            row = result[0] if isinstance(result, list) and result else {}
            label = normalize_runtime_language((row or {}).get("label"))
            if label:
                return {
                    "language": label,
                    "confidence": round(float((row or {}).get("score", 0.0) or 0.0), 3),
                    "source": "model",
                    "model_dir": str(selected_model_dir),
                }
        except Exception:
            pass

    if heuristic_language:
        return {
            "language": heuristic_language,
            "confidence": heuristic_confidence,
            "source": "heuristic",
        }

    return {
        "language": "",
        "confidence": heuristic_confidence,
        "source": "unknown",
    }
