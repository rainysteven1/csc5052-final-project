"""Load and render runtime prompt templates from documented files."""

from __future__ import annotations

import os
import re
from collections.abc import Mapping
from pathlib import Path

from services.agent.src.config import default_config_path, load_config, repo_root

DEFAULT_PROMPT_PATHS = {
    "reasoning_system": "prompts/reasoning_system.md",
    "reasoning_user": "prompts/reasoning_user.md",
    "feedback_system": "prompts/feedback_system.md",
    "feedback_user": "prompts/feedback_user.md",
    "json_repair_system": "prompts/json_repair_system.md",
    "json_repair_user": "prompts/json_repair_user.md",
    "reasoning_repair_schema": "prompts/schemas/reasoning_result.json",
    "feedback_repair_schema": "prompts/schemas/feedback_segments_result.json",
}

PROMPT_ENV_MAP = {
    "reasoning_system": "SPEAKSURE_REASONING_SYSTEM_PROMPT",
    "reasoning_user": "SPEAKSURE_REASONING_USER_PROMPT",
    "feedback_system": "SPEAKSURE_FEEDBACK_SYSTEM_PROMPT",
    "feedback_user": "SPEAKSURE_FEEDBACK_USER_PROMPT",
    "json_repair_system": "SPEAKSURE_JSON_REPAIR_SYSTEM_PROMPT",
    "json_repair_user": "SPEAKSURE_JSON_REPAIR_USER_PROMPT",
    "reasoning_repair_schema": "SPEAKSURE_REASONING_REPAIR_SCHEMA",
    "feedback_repair_schema": "SPEAKSURE_FEEDBACK_REPAIR_SCHEMA",
}

_PLACEHOLDER_PATTERN = re.compile(r"\{([A-Za-z_][A-Za-z0-9_]*)\}")


def _read_prompt_config(config_path: str | Path | None = None) -> dict[str, str]:
    cfg = load_config(config_path)
    prompts = cfg.speaksure.get("prompts", {})
    if not isinstance(prompts, dict):
        return {}
    return {str(key): str(value) for key, value in prompts.items()}


def _resolve_relative_path(raw_path: str, *, config_path: str | Path | None = None) -> Path:
    candidate = Path(raw_path)
    if candidate.is_absolute():
        return candidate.resolve()

    config_file = default_config_path() if config_path is None else Path(config_path).resolve()
    config_relative = (config_file.parent / candidate).resolve()
    if config_relative.exists():
        return config_relative

    repo_relative = (repo_root() / candidate).resolve()
    if repo_relative.exists():
        return repo_relative

    return config_relative


def resolve_prompt_template_path(template_name: str, *, config_path: str | Path | None = None) -> Path:
    if template_name not in DEFAULT_PROMPT_PATHS:
        raise KeyError(f"Unknown prompt template: {template_name}")

    env_name = PROMPT_ENV_MAP[template_name]
    raw_path = os.getenv(env_name, "").strip()
    if not raw_path:
        raw_path = _read_prompt_config(config_path).get(template_name, DEFAULT_PROMPT_PATHS[template_name])
    return _resolve_relative_path(raw_path, config_path=config_path)


def load_prompt_template(template_name: str, *, config_path: str | Path | None = None) -> str:
    path = resolve_prompt_template_path(template_name, config_path=config_path)
    return path.read_text(encoding="utf-8").strip()


def prompt_debug_enabled() -> bool:
    value = os.getenv("SPEAKSURE_DEBUG_PROMPTS", "").strip().lower()
    return value in {"1", "true", "yes", "on"}


def render_prompt_template(
    template_name: str,
    *,
    variables: Mapping[str, object],
    config_path: str | Path | None = None,
) -> str:
    template = load_prompt_template(template_name, config_path=config_path)

    def _replace(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in variables:
            return match.group(0)
        value = variables[key]
        return str(value)

    return _PLACEHOLDER_PATTERN.sub(_replace, template)
