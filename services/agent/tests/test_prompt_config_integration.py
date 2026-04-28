from __future__ import annotations

from pathlib import Path

from services.agent.src.schemas.analysis import ContextOutput, JudgmentOutput, LexicalOutput, SpeechSegment
import services.agent.src.backend.nodes.coaching_node as coaching_node_module
import services.agent.src.backend.nodes.feedback_node as feedback_node_module
import services.agent.src.backend.nodes.judgment_node as judgment_node_module
from services.agent.src.backend.tools.evidence_summary import build_evidence_summary
from services.agent.src.state import AnalysisState


class _FakeEnabledConfig:
    enabled = True


class _FakeJudgmentClient:
    def __init__(self, config, *, config_path=None) -> None:
        self.provider = "fake"
        self.model = "fake-model"
        self.config_path = config_path

    def chat_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        repair_schema_name: str | None = None,
        repair_schema_json: str | None = None,
    ):
        return {
            "summary": f"{system_prompt} || {user_prompt}",
            "dominant_causes": ["custom_judgment"],
            "coaching_focus": [repair_schema_name or "", repair_schema_json or ""],
            "risk_segments": ["seg_001"],
            "strengths": ["custom_strength"],
        }


class _FakeFeedbackClient:
    def __init__(self, config, *, config_path=None) -> None:
        self.provider = "fake"
        self.model = "fake-model"
        self.config_path = config_path

    def chat_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        repair_schema_name: str | None = None,
        repair_schema_json: str | None = None,
    ):
        return {
            "segments": [
                {
                    "segment_id": "seg_001",
                    "severity": "medium",
                    "focus_tags": ["custom_feedback"],
                    "reason": system_prompt,
                    "rewrite": user_prompt,
                    "practice": repair_schema_name,
                    "practice_steps": [repair_schema_json or ""],
                }
            ]
        }


class _FakeCoachingClient:
    def __init__(self, config, *, config_path=None) -> None:
        self.provider = "fake"
        self.model = "fake-model"
        self.config_path = config_path

    def chat_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        repair_schema_name: str | None = None,
        repair_schema_json: str | None = None,
    ):
        return {
            "summary": f"COACH::{system_prompt}",
            "coaching_focus": ["coach_focus_a", repair_schema_name or ""],
            "strengths": ["coach_strength"],
            "segments": [
                {
                    "segment_id": "seg_001",
                    "severity": "high",
                    "focus_tags": ["coaching_overlay"],
                    "reason": user_prompt,
                    "rewrite": "coach rewrite",
                    "practice": repair_schema_json or "",
                    "practice_steps": ["coach step"],
                }
            ],
        }


def test_synthesize_judgment_uses_prompt_templates_from_custom_config(
    tmp_path: Path,
    monkeypatch,
) -> None:
    prompts_dir = tmp_path / "prompts"
    schemas_dir = prompts_dir / "schemas"
    schemas_dir.mkdir(parents=True)
    (prompts_dir / "judgment_system.md").write_text("SYS::{scenario}::{payload_json}", encoding="utf-8")
    (prompts_dir / "judgment_user.md").write_text("USR::{scenario}", encoding="utf-8")
    (schemas_dir / "judgment_result.json").write_text('{"summary":"custom-schema"}', encoding="utf-8")

    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[speaksure.prompts]
judgment_system = "prompts/judgment_system.md"
judgment_user = "prompts/judgment_user.md"
judgment_repair_schema = "prompts/schemas/judgment_result.json"
""".strip(),
        encoding="utf-8",
    )

    monkeypatch.setattr(judgment_node_module, "resolve_runtime_llm_config", lambda: _FakeEnabledConfig())
    monkeypatch.setattr(judgment_node_module, "RuntimeLLMClient", _FakeJudgmentClient)

    state = AnalysisState(
        scenario="presentation",
        segments=[
            SpeechSegment(
                segment_id="seg_001",
                start=0.0,
                end=1.0,
                text="We definitely start now.",
                token_count=4,
            )
        ],
    )
    state.agent_outputs.context = ContextOutput(
        scenario="presentation",
        weights={"lexical": 0.4, "prosody": 0.3, "disfluency": 0.3, "context": 0.0},
        style_constraints=["stay direct"],
    )
    state.agent_outputs.lexical = [
        LexicalOutput(
            segment_id="seg_001",
            score=0.5,
            triggers=["definitely"],
            explanations=["custom"],
        )
    ]
    state.segments[0].scores.lexical = 0.5
    state.agent_outputs.evidence_summary = build_evidence_summary(state)

    result = judgment_node_module.synthesize_judgment(state, config_path=config_path)

    assert result.result.summary.startswith("SYS::presentation::")
    assert "USR::presentation" in result.result.summary
    assert "\"evidence_summary\"" in result.result.summary
    assert result.agent_outputs.judgment.summary == result.result.summary
    assert result.agent_outputs.judgment.risk_segments == ["seg_001"]
    assert result.agent_outputs.judgment.strengths == ["custom_strength"]
    assert result.agent_outputs.judgment.provider == "fake"
    assert result.agent_outputs.judgment.model == "fake-model"
    assert result.agent_outputs.judgment.coaching_focus == ["JudgmentResult", '{"summary":"custom-schema"}']


def test_apply_feedback_uses_prompt_templates_from_custom_config(tmp_path: Path, monkeypatch) -> None:
    prompts_dir = tmp_path / "prompts"
    schemas_dir = prompts_dir / "schemas"
    schemas_dir.mkdir(parents=True)
    (prompts_dir / "feedback_system.md").write_text("SYSFB::{scenario}::{style_constraints}", encoding="utf-8")
    (prompts_dir / "feedback_user.md").write_text("USRFB::{payload_json}", encoding="utf-8")
    (schemas_dir / "feedback_segments_result.json").write_text('{"segments":[{"segment_id":"x"}]}', encoding="utf-8")

    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[speaksure.prompts]
feedback_system = "prompts/feedback_system.md"
feedback_user = "prompts/feedback_user.md"
feedback_repair_schema = "prompts/schemas/feedback_segments_result.json"
""".strip(),
        encoding="utf-8",
    )

    monkeypatch.setattr(feedback_node_module, "resolve_runtime_llm_config", lambda: _FakeEnabledConfig())
    monkeypatch.setattr(feedback_node_module, "RuntimeLLMClient", _FakeFeedbackClient)

    state = AnalysisState(
        scenario="presentation",
        segments=[
            SpeechSegment(
                segment_id="seg_001",
                start=0.0,
                end=1.0,
                text="We definitely start now.",
                token_count=4,
            )
        ],
    )
    state.agent_outputs.context = ContextOutput(
        scenario="presentation",
        weights={"lexical": 0.4, "prosody": 0.3, "disfluency": 0.3, "context": 0.0},
        style_constraints=["steady pace"],
    )
    state.agent_outputs.lexical = [
        LexicalOutput(
            segment_id="seg_001",
            score=0.5,
            triggers=["definitely"],
            explanations=["custom"],
        )
    ]
    state.segments[0].scores.lexical = 0.5
    state.agent_outputs.evidence_summary = build_evidence_summary(state)
    state.agent_outputs.judgment = JudgmentOutput(
        summary="custom summary",
        coaching_focus=["stabilize pacing"],
        risk_segments=["seg_001"],
    )

    result = feedback_node_module.apply_feedback(state, config_path=config_path)

    feedback = result.agent_outputs.feedback[0]
    assert feedback.problem == "SYSFB::presentation::steady pace"
    assert feedback.rewrite.startswith("USRFB::")
    assert "\"evidence_summary\"" in feedback.rewrite
    assert "\"judgment\"" in feedback.rewrite
    assert feedback.practice == "FeedbackSegmentsResult"
    assert feedback.practice_steps == ['{"segments":[{"segment_id":"x"}]}']


def test_apply_coaching_uses_prompt_templates_from_custom_config(tmp_path: Path, monkeypatch) -> None:
    prompts_dir = tmp_path / "prompts"
    schemas_dir = prompts_dir / "schemas"
    schemas_dir.mkdir(parents=True)
    (prompts_dir / "coaching_system.md").write_text("SYSCO::{scenario}::{payload_json}", encoding="utf-8")
    (prompts_dir / "coaching_user.md").write_text("USRCO::{payload_json}", encoding="utf-8")
    (schemas_dir / "coaching_result.json").write_text('{"summary":"custom-coaching"}', encoding="utf-8")

    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[speaksure.runtime]
coaching_provider = "hybrid"

[speaksure.prompts]
coaching_system = "prompts/coaching_system.md"
coaching_user = "prompts/coaching_user.md"
coaching_repair_schema = "prompts/schemas/coaching_result.json"
""".strip(),
        encoding="utf-8",
    )

    monkeypatch.setattr(coaching_node_module, "resolve_runtime_llm_config", lambda: _FakeEnabledConfig())
    monkeypatch.setattr(coaching_node_module, "RuntimeLLMClient", _FakeCoachingClient)

    state = AnalysisState(
        scenario="presentation",
        segments=[
            SpeechSegment(
                segment_id="seg_001",
                start=0.0,
                end=1.0,
                text="We definitely start now.",
                token_count=4,
            )
        ],
    )
    state.agent_outputs.context = ContextOutput(
        scenario="presentation",
        weights={"lexical": 0.4, "prosody": 0.3, "disfluency": 0.3, "context": 0.0},
        style_constraints=["steady pace"],
    )
    state.agent_outputs.judgment = JudgmentOutput(
        summary="base summary",
        coaching_focus=["base focus"],
        strengths=["base strength"],
        risk_segments=["seg_001"],
    )
    state.agent_outputs.feedback = [
        feedback_node_module.FeedbackOutput(
            segment_id="seg_001",
            severity="medium",
            focus_tags=["prosody"],
            problem="base reason",
            rewrite="base rewrite",
            practice="base practice",
            practice_steps=["base step"],
        )
    ]
    state.segments[0].feedback = feedback_node_module.SegmentFeedback(
        severity="medium",
        focus_tags=["prosody"],
        reason="base reason",
        rewrite="base rewrite",
        practice="base practice",
        practice_steps=["base step"],
    )
    state.agent_outputs.evidence_summary = build_evidence_summary(state)

    result = coaching_node_module.apply_coaching(state, config_path=config_path)

    assert result.result.summary.startswith("COACH::SYSCO::presentation::")
    assert result.agent_outputs.judgment.coaching_focus == ["coach_focus_a", "CoachingResult"]
    assert result.agent_outputs.judgment.strengths == ["coach_strength"]
    assert result.agent_outputs.coaching.provider == "fake"
    assert result.agent_outputs.feedback[0].focus_tags == ["coaching_overlay"]
    assert result.agent_outputs.feedback[0].rewrite == "coach rewrite"
    assert result.agent_outputs.feedback[0].practice == '{"summary":"custom-coaching"}'
