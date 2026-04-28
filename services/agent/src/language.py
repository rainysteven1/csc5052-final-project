"""Language normalization helpers for runtime prompt and rule selection."""

from __future__ import annotations

from collections.abc import Mapping

SUPPORTED_RUNTIME_LANGUAGES = {"en", "zh"}


def normalize_runtime_language(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower().replace("_", "-")
    if not normalized:
        return None

    mapping = {
        "en": "en",
        "en-us": "en",
        "en-gb": "en",
        "english": "en",
        "zh": "zh",
        "zh-cn": "zh",
        "zh-tw": "zh",
        "zh-hans": "zh",
        "zh-hant": "zh",
        "chinese": "zh",
        "mandarin": "zh",
    }
    resolved = mapping.get(normalized)
    if resolved in SUPPORTED_RUNTIME_LANGUAGES:
        return resolved
    return None


def resolve_prompt_language(meta: Mapping[str, object] | None) -> str | None:
    if meta is None:
        return None
    for key in ("prompt_language_override", "response_language", "language"):
        resolved = normalize_runtime_language(meta.get(key))
        if resolved is not None:
            return resolved
    return None
