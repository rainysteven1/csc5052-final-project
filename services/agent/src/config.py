"""Minimal runtime configuration helpers for SpeakSure++."""

from __future__ import annotations

import os
import tomllib
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field


class RuntimeSettings(BaseModel):
    seed: int = 42
    speaksure: dict[str, Any] = Field(default_factory=dict)


_config_instance: RuntimeSettings | None = None


def repo_root() -> Path:
    env_path = os.getenv("SPEAKSURE_REPO_ROOT")
    if env_path:
        return Path(env_path).resolve()

    current = Path(__file__).resolve()
    for candidate in current.parents:
        if (candidate / ".git").exists() and (candidate / "services" / "agent").exists():
            return candidate
    return current.parents[3]


def service_root() -> Path:
    env_path = os.getenv("SPEAKSURE_AGENT_SERVICE_ROOT")
    if env_path:
        return Path(env_path).resolve()
    return (repo_root() / "services" / "agent").resolve()


def runtime_root() -> Path:
    env_path = os.getenv("SPEAKSURE_RUNTIME_ROOT")
    if env_path:
        return Path(env_path).resolve()
    return service_root()


def config_root() -> Path:
    env_path = os.getenv("SPEAKSURE_AGENT_CONFIG_ROOT")
    if env_path:
        return Path(env_path).resolve()
    return (service_root() / "config").resolve()


def data_root() -> Path:
    env_path = os.getenv("SPEAKSURE_AGENT_DATA_ROOT")
    if env_path:
        return Path(env_path).resolve()
    return (service_root() / "data").resolve()


def default_config_path() -> Path:
    env_path = os.getenv("SPEAKSURE_CONFIG_PATH")
    if env_path:
        return Path(env_path).resolve()
    return (config_root() / "config.toml").resolve()


def load_config(path: str | Path | None = None) -> RuntimeSettings:
    config_path = default_config_path() if path is None else Path(path).resolve()
    with config_path.open("rb") as handle:
        raw: dict[str, Any] = tomllib.load(handle)
    return RuntimeSettings.model_validate(raw)


def init_config(path: str | Path | None = None) -> RuntimeSettings:
    global _config_instance
    _config_instance = load_config(path)
    return _config_instance


def get_config() -> RuntimeSettings:
    global _config_instance
    if _config_instance is None:
        _config_instance = load_config()
    return _config_instance
