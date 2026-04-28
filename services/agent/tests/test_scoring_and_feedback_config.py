from __future__ import annotations

from pathlib import Path

from services.agent.src.schemas.analysis import ContextOutput, DisfluencyIssue, DisfluencyOutput, FeedbackOutput, LexicalOutput, ProsodyOutput, SpeechSegment
from services.agent.src.backend.nodes.feedback_node import apply_feedback
from services.agent.src.backend.tools.scorer import score_state
from services.agent.src.state import AnalysisState


def test_score_state_reads_scoring_rules_from_custom_config(tmp_path: Path) -> None:
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    (rules_dir / "scoring.toml").write_text(
        """
[default_weights]
lexical = 0.6
prosody = 0.2
disfluency = 0.2

[level_thresholds]
high = 0.8
medium = 0.4
low_floor = 0.05

[dominant_causes]
lexical = "custom_lexical"
prosody = "custom_prosody"
disfluency = "custom_disfluency"

[summaries]
lexical_only = "custom lexical summary"
prosody_only = "custom prosody summary"
disfluency_only = "custom disfluency summary"
mixed = "custom mixed summary"
stable = "custom stable summary"
""".strip(),
        encoding="utf-8",
    )
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[speaksure.rules]
scoring_rules = "rules/scoring.toml"
""".strip(),
        encoding="utf-8",
    )

    state = AnalysisState(
        scenario="presentation",
        segments=[SpeechSegment(segment_id="seg_001", start=0.0, end=1.0, text="hello", token_count=1)],
    )
    state.agent_outputs.context = ContextOutput(
        scenario="presentation",
        weights={},
        style_constraints=[],
    )
    state.segments[0].scores.lexical = 0.7
    state.segments[0].scores.prosody = 0.0
    state.segments[0].scores.disfluency = 0.0
    state.agent_outputs.lexical = [LexicalOutput(segment_id="seg_001", score=0.7, triggers=["maybe"], explanations=[])]

    payload = score_state(state, config_path=config_path)

    assert payload["overall_score"] == 0.42
    assert payload["level"] == "medium"
    assert payload["dominant_causes"] == ["custom_lexical"]
    assert payload["summary"] == "custom lexical summary"


def test_apply_feedback_reads_fallback_templates_from_custom_config(tmp_path: Path, monkeypatch) -> None:
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    (rules_dir / "feedback.toml").write_text(
        """
[reasons]
lexical = "LEX::{triggers}"
prosody = "PROSODY-REASON"
disfluency = "DIS::{issue_types}"
stable = "STABLE-REASON"

[practices]
lexical = "LEX-PRACTICE"
prosody = "PROSODY-PRACTICE"
disfluency = "DIS-PRACTICE"
stable = "STABLE-PRACTICE"
stable_steps = ["STEP-A", "STEP-B"]

[join]
prefix = "BEGIN-"
delimiter = " + "
suffix = "!"
practice_delimiter = " / "

[focus_tags]
lexical = "tag-lex"
prosody = "tag-prosody"
disfluency = "tag-dis"
""".strip(),
        encoding="utf-8",
    )
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[speaksure.rules]
feedback_fallback_rules = "rules/feedback.toml"
""".strip(),
        encoding="utf-8",
    )

    monkeypatch.setattr("services.agent.src.backend.nodes.feedback_node.resolve_runtime_llm_config", lambda: type("Cfg", (), {"enabled": False})())

    state = AnalysisState(
        scenario="presentation",
        segments=[SpeechSegment(segment_id="seg_001", start=0.0, end=1.0, text="maybe um start", token_count=3)],
    )
    state.agent_outputs.lexical = [LexicalOutput(segment_id="seg_001", score=0.3, triggers=["maybe"], explanations=[])]
    state.agent_outputs.prosody = [ProsodyOutput(segment_id="seg_001", score=0.2, features={}, explanations=[])]
    state.agent_outputs.disfluency = [
        DisfluencyOutput(
            segment_id="seg_001",
            score=0.1,
            issues=[DisfluencyIssue(type="filler", text="um", count=1)],
            explanations=[],
        )
    ]
    state.segments[0].scores.lexical = 0.3
    state.segments[0].scores.prosody = 0.2
    state.segments[0].scores.disfluency = 0.1

    result = apply_feedback(state, config_path=config_path)

    row: FeedbackOutput = result.agent_outputs.feedback[0]
    assert row.focus_tags == ["tag-lex", "tag-prosody", "tag-dis"]
    assert row.problem == "BEGIN-LEX::maybe + PROSODY-REASON + DIS::filler!"
    assert row.practice == "LEX-PRACTICE / PROSODY-PRACTICE / DIS-PRACTICE!"
