from __future__ import annotations

from services.agent.src.backend.tools.scorer import classify_level, score_state
from services.agent.src.schemas.analysis import ContextOutput, SpeechSegment
from services.agent.src.state import AnalysisState


def test_score_state_uses_context_weights() -> None:
    state = AnalysisState(
        scenario="interview",
        segments=[
            SpeechSegment(
                segment_id="seg_001",
                text="I think we should start now.",
                scores={"lexical": 0.8, "prosody": 0.2, "disfluency": 0.1},
            ),
            SpeechSegment(
                segment_id="seg_002",
                text="Um maybe continue.",
                scores={"lexical": 0.6, "prosody": 0.4, "disfluency": 0.5},
            ),
        ],
    )
    state.agent_outputs.context = ContextOutput(
        scenario="interview",
        weights={"lexical": 0.5, "prosody": 0.2, "disfluency": 0.1, "context": 0.2},
        style_constraints=["建议回答更直接"],
    )
    state.agent_outputs.lexical = [
        {"segment_id": "seg_001", "score": 0.8},
        {"segment_id": "seg_002", "score": 0.6},
    ]
    state.agent_outputs.prosody = [
        {"segment_id": "seg_001", "score": 0.2},
        {"segment_id": "seg_002", "score": 0.4},
    ]
    state.agent_outputs.disfluency = [
        {"segment_id": "seg_001", "score": 0.1},
        {"segment_id": "seg_002", "score": 0.5},
    ]

    payload = score_state(state)

    assert payload["overall_score"] == 0.42
    assert payload["risk_score"] == 0.58
    assert payload["context_average"] == 0.7
    assert payload["level"] == "developing"
    assert payload["dominant_causes"] == ["lexical_uncertainty", "prosody", "disfluency"]
    assert state.segments[0].scores.context == 0.8
    assert state.segments[1].scores.context == 0.6
    assert state.segments[0].scores.final == 0.61
    assert state.segments[1].scores.final == 0.55


def test_classify_level_thresholds() -> None:
    assert classify_level(0.0) == "excellent"
    assert classify_level(0.2) == "good"
    assert classify_level(0.4) == "developing"
    assert classify_level(0.8) == "needs_work"
