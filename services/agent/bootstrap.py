"""Shared startup helpers for SpeakSure++ services."""

from __future__ import annotations

import random
from pathlib import Path
from typing import TYPE_CHECKING

from dotenv import load_dotenv

if TYPE_CHECKING:
    from services.agent.src.config import RuntimeSettings


def discover_repo_root() -> Path:
    current = Path(__file__).resolve()
    for candidate in (current.parent, *current.parents):
        if (candidate / ".git").exists() and (candidate / "services").exists():
            return candidate
    return current.parents[1]


REPO_ROOT = discover_repo_root()
DOTENV_PATH = REPO_ROOT / ".env"
load_dotenv(DOTENV_PATH, override=False)


def load_project_dotenv(*, override: bool = False) -> Path | None:
    if not DOTENV_PATH.exists():
        return None
    load_dotenv(DOTENV_PATH, override=override)
    return DOTENV_PATH


def seed_everything(seed: int) -> None:
    random.seed(seed)
    try:
        import numpy as np

        np.random.seed(seed)
    except Exception:
        pass


def bootstrap_agent_runtime(
    *,
    config_path: str | Path | None = None,
    log_path: str | Path | None = None,
    initialize_runtime: bool = True,
) -> RuntimeSettings:
    from services.agent.src.config import data_root, init_config, service_root
    from services.agent.src.logger import init_logger
    from services.agent.src.runtime import init_runtime

    load_project_dotenv()
    service_root().mkdir(parents=True, exist_ok=True)
    data = data_root()
    data.mkdir(parents=True, exist_ok=True)
    (data / "analysis_outputs").mkdir(parents=True, exist_ok=True)
    (data / "cache").mkdir(parents=True, exist_ok=True)

    config = init_config(config_path)
    init_logger(log_path)
    seed_everything(config.seed)
    if initialize_runtime:
        init_runtime()
    return config


def bootstrap_asr_service(
    *,
    config_path: str | Path | None = None,
    log_path: str | Path | None = None,
) -> RuntimeSettings:
    from services.agent.src.config import init_config
    from services.agent.src.logger import init_logger

    load_project_dotenv()
    config = init_config(config_path)
    init_logger(log_path)
    seed_everything(config.seed)
    return config
