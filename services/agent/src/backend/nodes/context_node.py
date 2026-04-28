"""Scenario-aware context configuration for the runtime pipeline."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from services.agent.src.backend.tools.rule_loader import load_context_defaults
from services.agent.src.language import normalize_runtime_language, resolve_prompt_language
from services.agent.src.schemas.analysis import ContextOutput
from services.agent.src.services.artifact_loader import read_speaksure_section
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


def _read_context_override(
    section: dict[str, Any],
    scenario: str,
    *,
    language: str | None = None,
) -> dict[str, Any] | None:
    contexts = section.get("contexts", {}) if isinstance(section.get("contexts"), dict) else {}
    normalized_language = normalize_runtime_language(language)
    if normalized_language is not None:
        language_overrides = contexts.get("language_overrides", {})
        if isinstance(language_overrides, dict):
            scoped = language_overrides.get(normalized_language, {})
            if isinstance(scoped, dict):
                payload = scoped.get(scenario)
                if isinstance(payload, dict):
                    return payload

    payload = contexts.get(scenario)
    if isinstance(payload, dict):
        return payload
    return None


def load_context_config(
    scenario: str,
    config_path: str | Path | None = None,
    *,
    language: str | None = None,
) -> ContextOutput:
    section = read_speaksure_section(config_path)
    configured = _coerce_context_output(
        scenario,
        _read_context_override(section, scenario, language=language),
    )
    if configured is not None:
        return configured
    defaults = load_context_defaults(config_path=config_path, language=language)
    if scenario in defaults.contexts:
        return defaults.contexts[scenario].model_copy(deep=True)

    fallback = defaults.fallback.model_copy(deep=True)
    fallback.scenario = scenario
    return fallback


def apply_context(state: AnalysisState, config_path: str | Path | None = None) -> AnalysisState:
    state.agent_outputs.context = load_context_config(
        state.scenario,
        config_path,
        language=resolve_prompt_language(state.meta),
    )
    return state
