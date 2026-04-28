from __future__ import annotations

from pathlib import Path

from services.agent.src.backend.nodes.context_node import apply_context, load_context_config
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


def test_apply_context_reads_default_contexts_from_rule_config(tmp_path: Path) -> None:
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    (rules_dir / "contexts.toml").write_text(
        """
[contexts.demo]
scenario = "demo"
style_constraints = ["custom demo context"]

[contexts.demo.weights]
lexical = 0.4
prosody = 0.3
disfluency = 0.2
context = 0.1

[fallback]
scenario = "default"
style_constraints = ["custom fallback"]

[fallback.weights]
lexical = 0.25
prosody = 0.25
disfluency = 0.25
context = 0.25
""".strip(),
        encoding="utf-8",
    )
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[speaksure.rules]
context_defaults = "rules/contexts.toml"
""".strip(),
        encoding="utf-8",
    )

    result = apply_context(AnalysisState(scenario="demo"), config_path=config_path)
    fallback = apply_context(AnalysisState(scenario="unknown"), config_path=config_path)

    assert result.agent_outputs.context.style_constraints == ["custom demo context"]
    assert fallback.agent_outputs.context.scenario == "unknown"
    assert fallback.agent_outputs.context.style_constraints == ["custom fallback"]


def test_load_context_config_prefers_language_override_when_available(tmp_path: Path) -> None:
    config_path = tmp_path / "context.toml"
    config_path.write_text(
        """
[speaksure.contexts.interview.weights]
lexical = 0.6
disfluency = 0.1

[speaksure.contexts.interview]
style_constraints = ["中文默认"]

[speaksure.contexts.language_overrides.en.interview.weights]
lexical = 0.4
prosody = 0.4
disfluency = 0.1
context = 0.1

[speaksure.contexts.language_overrides.en.interview]
style_constraints = ["be direct", "trim hedges"]
""".strip(),
        encoding="utf-8",
    )

    context = load_context_config("interview", config_path=config_path, language="en")

    assert context.weights["lexical"] == 0.4
    assert context.style_constraints == ["be direct", "trim hedges"]
