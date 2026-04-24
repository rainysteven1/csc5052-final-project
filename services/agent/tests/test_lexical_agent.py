from __future__ import annotations

from services.agent.src.schemas.analysis import SpeechSegment
from services.agent.src.services.agent.nodes.lexical_node import analyze_lexical_uncertainty, build_lexical_rewrite
from services.agent.src.state import AnalysisState


def test_lexical_agent_detects_hedging_phrases() -> None:
    state = AnalysisState(
        scenario="interview",
        transcript="I think maybe we should start from the dataset.",
        segments=[
            SpeechSegment(
                segment_id="seg_001",
                start=0.0,
                end=1.0,
                text="I think maybe we should start from the dataset.",
                token_count=9,
            )
        ],
    )

    result = analyze_lexical_uncertainty(state)

    assert len(result.agent_outputs.lexical) == 1
    lexical = result.agent_outputs.lexical[0]
    assert lexical.score and lexical.score > 0
    assert "I think" in lexical.triggers
    assert "maybe" in lexical.triggers
    assert result.segments[0].highlights


def test_build_lexical_rewrite_removes_common_hedges() -> None:
    rewritten = build_lexical_rewrite("I think maybe we should start from the dataset.", ["I think", "maybe"])

    assert "I think" not in rewritten
    assert "maybe" not in rewritten.lower()
    assert rewritten.endswith(".")
