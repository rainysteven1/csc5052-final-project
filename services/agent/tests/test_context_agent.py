from __future__ import annotations

from pathlib import Path

from services.agent.src.services.agent.nodes.context_node import apply_context, load_context_config
from services.agent.src.state import AnalysisState


def test_load_context_config_from_custom_toml(tmp_path: Path) -> None:
    config_path = tmp_path / "context.toml"
    config_path.write_text(
        """
[speaksure.contexts.interview.weights]
lexical = 0.6
disfluency = 0.1

[speaksure.contexts.interview]
style_constraints = ["be direct", "avoid fillers"]
""".strip(),
        encoding="utf-8",
    )

    context = load_context_config("interview", config_path=config_path)

    assert context.weights["lexical"] == 0.6
    assert context.weights["disfluency"] == 0.1
    assert context.style_constraints == ["be direct", "avoid fillers"]


def test_apply_context_uses_default_when_scenario_missing() -> None:
    state = AnalysisState(scenario="unknown")

    result = apply_context(state)

    assert result.agent_outputs.context.scenario == "unknown"
    assert result.agent_outputs.context.style_constraints == ["使用默认场景配置"]
