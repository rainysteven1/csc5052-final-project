from __future__ import annotations

from pathlib import Path

from services.agent.src.asr.language_detector import detect_runtime_language
from services.agent.src.language import normalize_runtime_language


def test_normalize_runtime_language_handles_common_aliases() -> None:
    assert normalize_runtime_language("en-US") == "en"
    assert normalize_runtime_language("english") == "en"
    assert normalize_runtime_language("zh-CN") == "zh"
    assert normalize_runtime_language("mandarin") == "zh"
    assert normalize_runtime_language("fr") is None


def test_detect_runtime_language_prefers_english_heuristic_when_model_missing(tmp_path: Path) -> None:
    payload = detect_runtime_language(
        "I think we should start with the main point and keep the answer direct.",
        model_dir=tmp_path / "missing-model",
    )

    assert payload["language"] == "en"
    assert payload["source"] == "heuristic"
    assert payload["confidence"] > 0


def test_detect_runtime_language_prefers_chinese_heuristic_when_model_missing(tmp_path: Path) -> None:
    payload = detect_runtime_language(
        "我觉得我们应该先直接说明核心观点，然后再补充细节。",
        model_dir=Path(tmp_path) / "missing-model",
    )

    assert payload["language"] == "zh"
    assert payload["source"] == "heuristic"
    assert payload["confidence"] > 0
