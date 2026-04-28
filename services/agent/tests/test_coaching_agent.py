from __future__ import annotations

from pathlib import Path

import services.agent.src.backend.nodes.coaching_node as coaching_node_module
from services.agent.src.backend.tools.evidence_summary import build_evidence_summary
from services.agent.src.schemas.analysis import (
    ContextOutput,
    DisfluencyIssue,
    DisfluencyOutput,
    LexicalOutput,
    SpeechSegment,
)
from services.agent.src.state import AnalysisState


class _FakeDisabledConfig:
    enabled = False


class _FakeEnabledConfig:
    enabled = True


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
            "summary": f"coach::{system_prompt}",
            "coaching_focus": ["tighten the opening", repair_schema_name or ""],
            "strengths": ["confident close"],
            "segments": [
                {
                    "segment_id": "seg_001",
                    "severity": "high",
                    "focus_tags": ["coaching_overlay"],
                    "reason": user_prompt,
                    "rewrite": "State the claim directly.",
                    "practice": repair_schema_json or "",
                    "practice_steps": ["Say the first sentence in one breath."],
                }
            ],
        }


def _build_state() -> AnalysisState:
    state = AnalysisState(
        scenario="presentation",
        transcript="I think maybe we can start now. Um we should show the baseline.",
        segments=[
            SpeechSegment(
                segment_id="seg_001",
                start=0.0,
                end=1.2,
                text="I think maybe we can start now.",
                token_count=7,
            ),
            SpeechSegment(
                segment_id="seg_002",
                start=1.2,
                end=2.2,
                text="Um we should show the baseline.",
                token_count=6,
            ),
        ],
    )
    state.artifacts.providers["coaching"] = "hybrid"
    state.agent_outputs.context = ContextOutput(
        scenario="presentation",
        weights={"lexical": 0.4, "prosody": 0.3, "disfluency": 0.3, "context": 0.0},
        style_constraints=["Be direct", "Keep pacing stable"],
    )
    state.agent_outputs.lexical = [
        LexicalOutput(
            segment_id="seg_001",
            score=0.55,
            triggers=["I think", "maybe"],
            explanations=["The opening sounds hedged."],
            interpretation="The claim lands as tentative.",
            rewrite_hint="Open with a direct statement.",
            practice_hint="Repeat the first line without hedging.",
        )
    ]
    state.agent_outputs.disfluency = [
        DisfluencyOutput(
            segment_id="seg_002",
            score=0.35,
            issues=[DisfluencyIssue(type="filler", text="Um", count=1)],
            explanations=["A filler delays the transition."],
            interpretation="The transition loses momentum.",
            practice_hint="Pause silently before the next clause.",
            feedback_focus="clean transitions",
        )
    ]
    state.segments[0].scores.lexical = 0.55
    state.segments[1].scores.disfluency = 0.35
    state.agent_outputs.evidence_summary = build_evidence_summary(state)
    return state


def test_apply_coaching_builds_deterministic_package_when_llm_disabled(monkeypatch) -> None:
    monkeypatch.setattr(coaching_node_module, "resolve_runtime_llm_config", lambda: _FakeDisabledConfig())

    state = _build_state()
    result = coaching_node_module.apply_coaching(state)

    assert result.result.summary
    assert result.result.overall_score is not None and result.result.overall_score > 0
    assert result.agent_outputs.judgment.summary == result.result.summary
    assert result.agent_outputs.feedback
    assert result.agent_outputs.feedback[0].rewrite
    assert result.agent_outputs.coaching.summary == result.result.summary
    assert result.agent_outputs.coaching.coaching_focus
    assert result.agent_outputs.coaching.provider is None


def test_apply_coaching_uses_unified_prompt_and_overlays_feedback(tmp_path: Path, monkeypatch) -> None:
    prompts_dir = tmp_path / "prompts"
    schemas_dir = prompts_dir / "schemas"
    schemas_dir.mkdir(parents=True)
    (prompts_dir / "coaching_system.md").write_text("SYS::{scenario}::{payload_json}", encoding="utf-8")
    (prompts_dir / "coaching_user.md").write_text("USR::{payload_json}", encoding="utf-8")
    (schemas_dir / "coaching_result.json").write_text('{"summary":"schema"}', encoding="utf-8")

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

    state = _build_state()
    result = coaching_node_module.apply_coaching(state, config_path=config_path)

    assert result.result.summary.startswith("coach::SYS::presentation::")
    assert result.agent_outputs.judgment.summary == result.result.summary
    assert result.agent_outputs.coaching.summary == result.result.summary
    assert result.agent_outputs.coaching.coaching_focus == ["tighten the opening", "CoachingResult"]
    assert result.agent_outputs.coaching.strengths == ["confident close"]
    assert result.agent_outputs.coaching.provider == "fake"
    assert result.agent_outputs.feedback[0].severity == "high"
    assert result.agent_outputs.feedback[0].rewrite == "State the claim directly."
    assert result.agent_outputs.feedback[0].practice_steps == ["Say the first sentence in one breath."]
    assert result.meta["llm_coaching"] == {"provider": "fake", "model": "fake-model"}
