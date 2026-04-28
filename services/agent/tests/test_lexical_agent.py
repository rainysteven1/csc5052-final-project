from __future__ import annotations

from pathlib import Path

import services.agent.src.backend.nodes.lexical_node as lexical_node_module
from services.agent.src.backend.nodes.lexical_node import analyze_lexical_uncertainty, build_lexical_rewrite
from services.agent.src.schemas.analysis import SpeechSegment
from services.agent.src.state import AnalysisState


class _FakeEnabledConfig:
    enabled = True


class _FakeLexicalClient:
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
            "rewrite_hint": f"REWRITE::{user_prompt}",
            "practice_hint": repair_schema_name or "",
        }


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


def test_lexical_agent_reads_rules_from_custom_config(tmp_path: Path) -> None:
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    (rules_dir / "lexical.toml").write_text(
        """
[[rules]]
phrase = "definitely"
weight = 0.5
explanation = "custom lexical explanation"
""".strip(),
        encoding="utf-8",
    )
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[speaksure.rules]
lexical_rules = "rules/lexical.toml"
""".strip(),
        encoding="utf-8",
    )

    state = AnalysisState(
        scenario="interview",
        transcript="We definitely start now.",
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

    result = analyze_lexical_uncertainty(state, config_path=config_path)

    lexical = result.agent_outputs.lexical[0]
    assert lexical.score == 0.5
    assert lexical.explanations == ["custom lexical explanation"]
    assert lexical.triggers == ["definitely"]


def test_lexical_agent_can_use_llm_interpretation_when_provider_is_hybrid(
    tmp_path: Path,
    monkeypatch,
) -> None:
    prompts_dir = tmp_path / "prompts"
    schemas_dir = prompts_dir / "schemas"
    prompts_dir.mkdir()
    schemas_dir.mkdir()
    (prompts_dir / "lexical_system.md").write_text("SYS::{scenario}::{payload_json}", encoding="utf-8")
    (prompts_dir / "lexical_user.md").write_text("USR::{payload_json}", encoding="utf-8")
    (schemas_dir / "lexical_result.json").write_text(
        '{"interpretation":"ok","rewrite_hint":"ok","practice_hint":"ok"}',
        encoding="utf-8",
    )
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[speaksure.runtime]
lexical_provider = "hybrid"

[speaksure.prompts]
lexical_system = "prompts/lexical_system.md"
lexical_user = "prompts/lexical_user.md"
lexical_repair_schema = "prompts/schemas/lexical_result.json"
""".strip(),
        encoding="utf-8",
    )

    monkeypatch.setattr(lexical_node_module, "resolve_runtime_llm_config", lambda: _FakeEnabledConfig())
    monkeypatch.setattr(lexical_node_module, "RuntimeLLMClient", _FakeLexicalClient)

    state = AnalysisState(
        scenario="presentation",
        transcript="I think we should start now.",
        segments=[
            SpeechSegment(
                segment_id="seg_001",
                start=0.0,
                end=1.0,
                text="I think we should start now.",
                token_count=6,
            )
        ],
    )

    result = analyze_lexical_uncertainty(state, config_path=config_path)

    lexical = result.agent_outputs.lexical[0]
    assert lexical.interpretation and lexical.interpretation.startswith("LLM::SYS::presentation::")
    assert lexical.rewrite_hint and lexical.rewrite_hint.startswith("REWRITE::USR::")
    assert lexical.practice_hint == "LexicalResult"
    assert lexical.provider == "fake"
    assert lexical.model == "fake-model"
    assert any(item.startswith("LLM::SYS::presentation::") for item in lexical.explanations)
    assert result.meta["llm_lexical"]["seg_001"]["provider"] == "fake"
