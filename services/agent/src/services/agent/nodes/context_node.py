"""Scenario-aware context configuration for the runtime pipeline."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from services.agent.src.schemas.analysis import ContextOutput
from services.agent.src.services.artifact_loader import read_speaksure_section
from services.agent.src.state import AnalysisState

DEFAULT_CONTEXTS: dict[str, ContextOutput] = {
    "interview": ContextOutput(
        scenario="interview",
        weights={"lexical": 0.35, "prosody": 0.30, "disfluency": 0.20, "context": 0.15},
        style_constraints=["避免过多弱化表达", "建议回答更直接"],
    ),
    "presentation": ContextOutput(
        scenario="presentation",
        weights={"lexical": 0.30, "prosody": 0.35, "disfluency": 0.20, "context": 0.15},
        style_constraints=["保持节奏稳定", "控制长停顿"],
    ),
    "academic": ContextOutput(
        scenario="academic",
        weights={"lexical": 0.25, "prosody": 0.25, "disfluency": 0.20, "context": 0.30},
        style_constraints=["允许适度谨慎表达", "避免连续自我修正"],
    ),
    "business": ContextOutput(
        scenario="business",
        weights={"lexical": 0.35, "prosody": 0.25, "disfluency": 0.20, "context": 0.20},
        style_constraints=["表达应直接清晰", "减少模糊承诺词"],
    ),
    "casual": ContextOutput(
        scenario="casual",
        weights={"lexical": 0.25, "prosody": 0.25, "disfluency": 0.25, "context": 0.25},
        style_constraints=["自然表达即可"],
    ),
}


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
    return DEFAULT_CONTEXTS.get(
        scenario,
        ContextOutput(
            scenario=scenario,
            weights={"lexical": 0.25, "prosody": 0.25, "disfluency": 0.25, "context": 0.25},
            style_constraints=["使用默认场景配置"],
        ),
    )


def apply_context(state: AnalysisState, config_path: str | Path | None = None) -> AnalysisState:
    state.agent_outputs.context = load_context_config(state.scenario, config_path)
    return state
