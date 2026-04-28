"""Helpers for loading runtime artifacts without coupling to trainer code."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import tomllib
from pydantic import BaseModel, Field

from services.agent.src.config import default_config_path
from services.agent.src.schemas.analysis import ArtifactMetadata


class ArtifactBundle(BaseModel):
    metadata: ArtifactMetadata = Field(default_factory=ArtifactMetadata)
    warnings: list[str] = Field(default_factory=list)


DEFAULT_AGENT_GRPC_BIND = "127.0.0.1:50051"
DEFAULT_ASR_GRPC_BIND = "127.0.0.1:50052"
RUNTIME_ENV_MAP = {
    "asr_provider": "SPEAKSURE_ASR_PROVIDER",
}


def resolve_runtime_config_path(config_path: str | Path | None = None) -> Path:
    if config_path is not None:
        return Path(config_path).resolve()
    return default_config_path()


def read_speaksure_section(config_path: str | Path | None = None) -> dict[str, Any]:
    resolved_path = resolve_runtime_config_path(config_path)
    return _read_config_sections(resolved_path)


def _read_config_sections(config_path: Path | None) -> dict[str, Any]:
    if config_path is None or not config_path.exists():
        return {}
    with config_path.open("rb") as handle:
        raw = tomllib.load(handle)
    for key in ("speaksure", "inference"):
        section = raw.get(key)
        if isinstance(section, dict):
            return section
    return {}


def _read_runtime_env_overrides() -> dict[str, str]:
    overrides: dict[str, str] = {}
    for key, env_name in RUNTIME_ENV_MAP.items():
        value = os.getenv(env_name)
        if value is None:
            continue
        normalized = value.strip()
        if normalized:
            overrides[key] = normalized
    return overrides


def load_artifacts(
    config_path: str | Path | None = None,
    overrides: dict[str, str] | None = None,
) -> ArtifactBundle:
    config_file = resolve_runtime_config_path(config_path)
    section = _read_config_sections(config_file)
    artifact_section = section.get("artifacts", {}) if isinstance(section.get("artifacts"), dict) else {}
    runtime_section = section.get("runtime", {}) if isinstance(section.get("runtime"), dict) else {}
    merged: dict[str, Any] = {**artifact_section, **runtime_section}
    if overrides:
        merged.update(overrides)
    merged.update(_read_runtime_env_overrides())

    providers = {
        "asr": str(merged.get("asr_provider", "stub")),
        "lexical": str(merged.get("lexical_provider", "rule")),
        "prosody": str(merged.get("prosody_provider", "rule")),
        "disfluency": str(merged.get("disfluency_provider", "rule")),
        "context": str(merged.get("context_provider", "config")),
        "coaching": str(merged.get("coaching_provider", "disabled")),
    }
    paths = {
        key: str(value)
        for key, value in merged.items()
        if (
            key.endswith("_path")
            or key.endswith("_dir")
            or key.endswith("_file")
            or key.endswith("_url")
            or key.endswith("_target")
            or key.endswith("_bind")
        )
    }

    metadata = ArtifactMetadata(
        asr_model_version=str(merged.get("asr_model_version", f"{providers['asr']}-asr-v1")),
        lexical_model_version=str(merged.get("lexical_model_version", f"{providers['lexical']}-v1")),
        prosody_model_version=str(merged.get("prosody_model_version", f"{providers['prosody']}-v1")),
        disfluency_model_version=str(merged.get("disfluency_model_version", f"{providers['disfluency']}-v1")),
        config_version=str(merged.get("config_version", config_file.name if config_file else "runtime-default")),
        fallback_mode=providers["asr"] == "stub",
        providers=providers,
        paths=paths,
    )

    warnings: list[str] = []
    if providers["asr"] == "stub":
        warnings.append(
            "Live ASR artifact not configured; runtime will use transcript override, "
            "sidecar, manifest, or stub fallback."
        )
    elif providers["asr"] == "grpc" and not paths.get("asr_grpc_target"):
        warnings.append(
            "ASR provider is configured as grpc, but `asr_grpc_target` is missing; "
            "runtime may fall back to stub."
        )
    elif providers["asr"] == "api" and not paths.get("asr_api_url"):
        warnings.append(
            "ASR provider is configured as api, but `asr_api_url` is missing; "
            "runtime may fall back to stub."
        )

    return ArtifactBundle(metadata=metadata, warnings=warnings)


def resolve_runtime_path_setting(
    key: str,
    *,
    default: str,
    config_path: str | Path | None = None,
) -> str:
    artifacts = load_artifacts(config_path=config_path)
    value = str(artifacts.metadata.paths.get(key, "")).strip()
    return value or default


def resolve_agent_grpc_bind(config_path: str | Path | None = None) -> str:
    return resolve_runtime_path_setting(
        "agent_grpc_bind",
        default=DEFAULT_AGENT_GRPC_BIND,
        config_path=config_path,
    )


def resolve_asr_grpc_bind(config_path: str | Path | None = None) -> str:
    return resolve_runtime_path_setting(
        "asr_grpc_bind",
        default=DEFAULT_ASR_GRPC_BIND,
        config_path=config_path,
    )

