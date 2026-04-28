"""Scenario-aware context configuration for the runtime pipeline."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from services.agent.src.schemas.analysis import ContextOutput
from services.agent.src.services.artifact_loader import read_speaksure_section
from services.agent.src.backend.tools.rule_loader import load_context_defaults
from services.agent.src.state import AnalysisState


def _coerce_context_output(scenario: str, payload: dict[str, Any] | None) -> ContextOutput | None:
    if not isinstance(payload, dict):
        return None
    weights = payload.get("weights", {})
    style_constraints = payload.get("style_constraints", [])
    return ContextOutput(
        scenario=scenario,
        weights={key: float(value) for key, value in weights.items()},
        style_constraints=[str(item) for item in style_constraints],
    )


def load_context_config(scenario: str, config_path: str | Path | None = None) -> ContextOutput:
    section = read_speaksure_section(config_path)
    contexts = section.get("contexts", {}) if isinstance(section.get("contexts"), dict) else {}
    configured = _coerce_context_output(scenario, contexts.get(scenario))
    if configured is not None:
        return configured
    defaults = load_context_defaults(config_path=config_path)
    if scenario in defaults.contexts:
        return defaults.contexts[scenario].model_copy(deep=True)

    fallback = defaults.fallback.model_copy(deep=True)
    fallback.scenario = scenario
    return fallback


def apply_context(state: AnalysisState, config_path: str | Path | None = None) -> AnalysisState:
    state.agent_outputs.context = load_context_config(state.scenario, config_path)
    return state
