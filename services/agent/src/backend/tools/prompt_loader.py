"""Load and render runtime prompt templates from documented files."""

from __future__ import annotations

import os
import re
from collections.abc import Mapping
from pathlib import Path

from services.agent.src.config import default_config_path, load_config, repo_root
from services.agent.src.language import normalize_runtime_language

DEFAULT_PROMPT_PATHS = {
    "lexical_system": "prompts/lexical_system.md",
    "lexical_user": "prompts/lexical_user.md",
    "prosody_system": "prompts/prosody_system.md",
    "prosody_user": "prompts/prosody_user.md",
    "disfluency_system": "prompts/disfluency_system.md",
    "disfluency_user": "prompts/disfluency_user.md",
    "coaching_system": "prompts/coaching_system.md",
    "coaching_user": "prompts/coaching_user.md",
    "lexical_repair_schema": "prompts/schemas/lexical_result.json",
    "disfluency_repair_schema": "prompts/schemas/disfluency_result.json",
    "prosody_repair_schema": "prompts/schemas/prosody_result.json",
    "coaching_repair_schema": "prompts/schemas/coaching_result.json",
    "judgment_system": "prompts/judgment_system.md",
    "judgment_user": "prompts/judgment_user.md",
    "feedback_system": "prompts/feedback_system.md",
    "feedback_user": "prompts/feedback_user.md",
    "json_repair_system": "prompts/json_repair_system.md",
    "json_repair_user": "prompts/json_repair_user.md",
    "judgment_repair_schema": "prompts/schemas/judgment_result.json",
    "feedback_repair_schema": "prompts/schemas/feedback_segments_result.json",
}

PROMPT_ENV_MAP = {
    "lexical_system": "SPEAKSURE_LEXICAL_SYSTEM_PROMPT",
    "lexical_user": "SPEAKSURE_LEXICAL_USER_PROMPT",
    "prosody_system": "SPEAKSURE_PROSODY_SYSTEM_PROMPT",
    "prosody_user": "SPEAKSURE_PROSODY_USER_PROMPT",
    "disfluency_system": "SPEAKSURE_DISFLUENCY_SYSTEM_PROMPT",
    "disfluency_user": "SPEAKSURE_DISFLUENCY_USER_PROMPT",
    "coaching_system": "SPEAKSURE_COACHING_SYSTEM_PROMPT",
    "coaching_user": "SPEAKSURE_COACHING_USER_PROMPT",
    "lexical_repair_schema": "SPEAKSURE_LEXICAL_REPAIR_SCHEMA",
    "disfluency_repair_schema": "SPEAKSURE_DISFLUENCY_REPAIR_SCHEMA",
    "prosody_repair_schema": "SPEAKSURE_PROSODY_REPAIR_SCHEMA",
    "coaching_repair_schema": "SPEAKSURE_COACHING_REPAIR_SCHEMA",
    "judgment_system": "SPEAKSURE_JUDGMENT_SYSTEM_PROMPT",
    "judgment_user": "SPEAKSURE_JUDGMENT_USER_PROMPT",
    "feedback_system": "SPEAKSURE_FEEDBACK_SYSTEM_PROMPT",
    "feedback_user": "SPEAKSURE_FEEDBACK_USER_PROMPT",
    "json_repair_system": "SPEAKSURE_JSON_REPAIR_SYSTEM_PROMPT",
    "json_repair_user": "SPEAKSURE_JSON_REPAIR_USER_PROMPT",
    "judgment_repair_schema": "SPEAKSURE_JUDGMENT_REPAIR_SCHEMA",
    "feedback_repair_schema": "SPEAKSURE_FEEDBACK_REPAIR_SCHEMA",
}

_PLACEHOLDER_PATTERN = re.compile(r"\{([A-Za-z_][A-Za-z0-9_]*)\}")


def _read_prompt_sections(config_path: str | Path | None = None) -> tuple[dict[str, str], dict[str, dict[str, str]]]:
    cfg = load_config(config_path)
    prompts = cfg.speaksure.get("prompts", {})
    if not isinstance(prompts, dict):
        return {}, {}

    base_paths = {
        str(key): str(value)
        for key, value in prompts.items()
        if isinstance(value, str)
    }
    language_overrides_raw = prompts.get("language_overrides", {})
    language_overrides: dict[str, dict[str, str]] = {}
    if isinstance(language_overrides_raw, dict):
        for language, values in language_overrides_raw.items():
            if not isinstance(values, dict):
                continue
            normalized_language = normalize_runtime_language(language)
            if normalized_language is None:
                continue
            language_overrides[normalized_language] = {
                str(key): str(value)
                for key, value in values.items()
                if isinstance(value, str)
            }
    return base_paths, language_overrides


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


def resolve_prompt_template_path(
    template_name: str,
    *,
    config_path: str | Path | None = None,
    language: str | None = None,
) -> Path:
    if template_name not in DEFAULT_PROMPT_PATHS:
        raise KeyError(f"Unknown prompt template: {template_name}")

    env_name = PROMPT_ENV_MAP[template_name]
    raw_path = os.getenv(env_name, "").strip()
    if raw_path:
        return _resolve_relative_path(raw_path, config_path=config_path)

    configured_paths, language_overrides = _read_prompt_sections(config_path)
    normalized_language = normalize_runtime_language(language)
    if normalized_language is not None:
        raw_path = language_overrides.get(normalized_language, {}).get(template_name)
        if raw_path is not None:
            return _resolve_relative_path(raw_path, config_path=config_path)

    raw_path = configured_paths.get(template_name)
    if raw_path is not None:
        return _resolve_relative_path(raw_path, config_path=config_path)

    return _resolve_relative_path(DEFAULT_PROMPT_PATHS[template_name], config_path=default_config_path())


def load_prompt_template(
    template_name: str,
    *,
    config_path: str | Path | None = None,
    language: str | None = None,
) -> str:
    path = resolve_prompt_template_path(template_name, config_path=config_path, language=language)
    return path.read_text(encoding="utf-8").strip()


def prompt_debug_enabled() -> bool:
    value = os.getenv("SPEAKSURE_DEBUG_PROMPTS", "").strip().lower()
    return value in {"1", "true", "yes", "on"}


def render_prompt_template(
    template_name: str,
    *,
    variables: Mapping[str, object],
    config_path: str | Path | None = None,
    language: str | None = None,
) -> str:
    template = load_prompt_template(template_name, config_path=config_path, language=language)

    def _replace(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in variables:
            return match.group(0)
        value = variables[key]
        return str(value)

    return _PLACEHOLDER_PATTERN.sub(_replace, template)
