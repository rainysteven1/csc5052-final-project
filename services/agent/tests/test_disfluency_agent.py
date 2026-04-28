from __future__ import annotations

from pathlib import Path

import services.agent.src.backend.nodes.disfluency_node as disfluency_node_module
from services.agent.src.schemas.analysis import SpeechSegment
from services.agent.src.backend.nodes.disfluency_node import analyze_disfluency
from services.agent.src.state import AnalysisState


class _FakeEnabledConfig:
    enabled = True


class _FakeDisfluencyClient:
    def __init__(self, config, *, config_path=None) -> None:
        self.provider = "fake"
        self.model = "fake-model"

    def chat_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        repair_schema_name: str | None = None,
        repair_schema_json: str | None = None,
    ):
        return {
            "interpretation": f"LLM::{system_prompt}",
            "practice_hint": f"PRACTICE::{user_prompt}",
            "feedback_focus": repair_schema_name or "",
        }


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


def test_disfluency_agent_reads_rules_from_custom_config(tmp_path: Path) -> None:
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    (rules_dir / "disfluency.toml").write_text(
        """
[scoring]
filler_weight = 0.4
self_repair_weight = 0.3
repetition_weight = 0.2
repetition_token_pattern = "\\\\b[\\\\w']+\\\\b"

[explanations]
filler = "custom filler"
repeat = "custom repeat"
self_repair = "custom repair"

[[filler_patterns]]
label = "erm"
pattern = "\\\\berm\\\\b"

[[self_repair_patterns]]
label = "wait"
pattern = "\\\\bwait\\\\b"
""".strip(),
        encoding="utf-8",
    )
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[speaksure.rules]
disfluency_rules = "rules/disfluency.toml"
""".strip(),
        encoding="utf-8",
    )

    state = AnalysisState(
        scenario="interview",
        transcript="Erm wait wait we begin.",
        segments=[
            SpeechSegment(
                segment_id="seg_001",
                start=0.0,
                end=1.0,
                text="Erm wait wait we begin.",
                token_count=5,
            )
        ],
    )

    result = analyze_disfluency(state, config_path=config_path)

    output = result.agent_outputs.disfluency[0]
    assert output.score == 1.0
    assert any(issue.type == "self_repair" and issue.count == 2 for issue in output.issues)
    assert output.explanations == ["custom filler", "custom repeat", "custom repair"]


def test_disfluency_agent_can_use_llm_interpretation_when_provider_is_hybrid(
    tmp_path: Path,
    monkeypatch,
) -> None:
    prompts_dir = tmp_path / "prompts"
    schemas_dir = prompts_dir / "schemas"
    prompts_dir.mkdir()
    schemas_dir.mkdir()
    (prompts_dir / "disfluency_system.md").write_text("SYS::{scenario}::{payload_json}", encoding="utf-8")
    (prompts_dir / "disfluency_user.md").write_text("USR::{payload_json}", encoding="utf-8")
    (schemas_dir / "disfluency_result.json").write_text(
        '{"interpretation":"ok","practice_hint":"ok","feedback_focus":"ok"}',
        encoding="utf-8",
    )
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[speaksure.runtime]
disfluency_provider = "hybrid"

[speaksure.prompts]
disfluency_system = "prompts/disfluency_system.md"
disfluency_user = "prompts/disfluency_user.md"
disfluency_repair_schema = "prompts/schemas/disfluency_result.json"
""".strip(),
        encoding="utf-8",
    )

    monkeypatch.setattr(disfluency_node_module, "resolve_runtime_llm_config", lambda: _FakeEnabledConfig())
    monkeypatch.setattr(disfluency_node_module, "RuntimeLLMClient", _FakeDisfluencyClient)

    state = AnalysisState(
        scenario="presentation",
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

    result = analyze_disfluency(state, config_path=config_path)

    output = result.agent_outputs.disfluency[0]
    assert output.interpretation and output.interpretation.startswith("LLM::SYS::presentation::")
    assert output.practice_hint and output.practice_hint.startswith("PRACTICE::USR::")
    assert output.feedback_focus == "DisfluencyResult"
    assert output.provider == "fake"
    assert output.model == "fake-model"
    assert any(item.startswith("LLM::SYS::presentation::") for item in output.explanations)
    assert result.meta["llm_disfluency"]["seg_001"]["provider"] == "fake"
