from __future__ import annotations

from services.agent.src.schemas.analysis import SpeechSegment
from services.agent.src.services.agent.nodes.disfluency_node import analyze_disfluency
from services.agent.src.state import AnalysisState


def test_disfluency_agent_detects_fillers_repetition_and_repair() -> None:
    state = AnalysisState(
        scenario="interview",
        transcript="Um I I think, no, I mean we can start now.",
        segments=[
            SpeechSegment(
                segment_id="seg_001",
                start=0.0,
                end=1.0,
                text="Um I I think, no, I mean we can start now.",
                token_count=10,
            )
        ],
    )

    result = analyze_disfluency(state)

    assert len(result.agent_outputs.disfluency) == 1
    output = result.agent_outputs.disfluency[0]
    assert output.score and output.score > 0
    issue_types = {issue.type for issue in output.issues}
    assert "filler" in issue_types
    assert "repeat" in issue_types
    assert "self_repair" in issue_types
    assert any(highlight.type == "filler" for highlight in result.segments[0].highlights)
