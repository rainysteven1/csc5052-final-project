from __future__ import annotations

from services.agent.src.schemas.analysis import ContextOutput, DisfluencyIssue, DisfluencyOutput, LexicalOutput, ProsodyOutput, SpeechSegment
from services.agent.src.backend.tools.evidence_summary import build_evidence_summary
from services.agent.src.state import AnalysisState


def test_build_evidence_summary_collects_stage_outputs() -> None:
    state = AnalysisState(
        scenario="presentation",
        segments=[
            SpeechSegment(
                segment_id="seg_001",
                start=0.0,
                end=1.0,
                text="Maybe we begin now.",
                pause_before=0.2,
                token_count=4,
                scores={"lexical": 0.4, "prosody": 0.2, "disfluency": 0.1, "final": 0.3},
            )
        ],
    )
    state.agent_outputs.context = ContextOutput(
        scenario="presentation",
        weights={"lexical": 0.3, "prosody": 0.4, "disfluency": 0.3, "context": 0.0},
        style_constraints=["stay direct"],
    )
    state.agent_outputs.lexical = [
        LexicalOutput(segment_id="seg_001", score=0.4, triggers=["Maybe"], explanations=["hedge"])
    ]
    state.agent_outputs.prosody = [
        ProsodyOutput(segment_id="seg_001", score=0.2, features={"speech_rate": 2.5}, explanations=["pace"])
    ]
    state.agent_outputs.disfluency = [
        DisfluencyOutput(
            segment_id="seg_001",
            score=0.1,
            issues=[DisfluencyIssue(type="filler", text="um", count=1)],
            explanations=["repair"],
        )
    ]

    summary = build_evidence_summary(state)

    assert summary.version == "v1"
    assert summary.segment_count == 1
    assert summary.trigger_count == 1
    assert summary.disfluency_issue_count == 1
    assert summary.average_scores["lexical"] == 0.4
    assert summary.style_constraints == ["stay direct"]
    assert summary.segments[0].lexical_triggers == ["Maybe"]
    assert summary.segments[0].disfluency_issues == ["filler:umx1"]
    assert summary.segments[0].dominant_signals == ["lexical", "prosody", "disfluency"]
    assert summary.dominant_dimensions == ["lexical", "prosody", "disfluency"]
    assert summary.top_lexical_triggers[0].label == "maybe"
    assert summary.top_disfluency_patterns[0].label == "filler:um"
    assert summary.prosody_hotspots[0].segment_id == "seg_001"
    assert summary.risk_segments[0].segment_id == "seg_001"
    assert "lexical_triggers:1" in summary.signal_overview
