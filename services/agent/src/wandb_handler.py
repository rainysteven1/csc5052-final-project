"""Lightweight W&B handler for SpeakSure++ runtime results."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from services.agent.src.logger import logger
from services.agent.src.services.artifact_loader import read_speaksure_section


@dataclass(frozen=True)
class WandbRuntimeConfig:
    project: str = "speaksure-runtime"
    entity: str | None = None
    mode: str = "disabled"


def resolve_wandb_config(config_path: str | Path | None = None) -> WandbRuntimeConfig:
    section = read_speaksure_section(config_path)
    wandb_section = section.get("wandb", {}) if isinstance(section.get("wandb"), dict) else {}
    return WandbRuntimeConfig(
        project=str(wandb_section.get("project") or os.getenv("WANDB_PROJECT") or "speaksure-runtime"),
        entity=str(wandb_section.get("entity") or os.getenv("WANDB_ENTITY") or "").strip() or None,
        mode=str(wandb_section.get("mode") or os.getenv("WANDB_MODE") or "disabled"),
    )


class WandbHandler:
    """Tiny wrapper around wandb for result uploads."""

    def __init__(self, config_path: str | Path | None = None) -> None:
        self._cfg = resolve_wandb_config(config_path)
        self._run = None
        self._tables: dict[str, Any] = {}

    def init_run(self, *, run_name: str, config: dict[str, Any] | None = None, tags: list[str] | None = None) -> bool:
        try:
            import wandb
        except ModuleNotFoundError:
            logger.warning("[Wandb] wandb package not installed; upload skipped")
            return False

        if self._cfg.mode == "disabled":
            logger.info("[Wandb] mode=disabled; upload skipped")
            return False

        api_key = os.getenv("WANDB_API_KEY")
        if self._cfg.mode == "online" and api_key:
            try:
                wandb.login(key=api_key)
            except Exception as exc:  # pragma: no cover - external service
                logger.warning("[Wandb] login failed: {}", exc)

        self._run = wandb.init(
            project=self._cfg.project,
            entity=self._cfg.entity,
            mode=self._cfg.mode,
            name=run_name,
            config=config or {},
            tags=tags or [],
        )
        return self._run is not None

    def log_metrics(self, metrics: dict[str, Any], *, step: int | None = None) -> None:
        if self._run is None:
            return
        self._run.log(metrics, step=step)

    def log_table_rows(self, name: str, rows: list[dict[str, Any]], *, step: int | None = None) -> None:
        if self._run is None or not rows:
            return

        import wandb

        table = wandb.Table(columns=list(rows[0].keys()))
        for row in rows:
            table.add_data(*[row.get(column) for column in table.columns])
        self._run.log({name: table}, step=step)

    def log_summary(self, metrics: dict[str, Any]) -> None:
        if self._run is None:
            return
        for key, value in metrics.items():
            self._run.summary[key] = value

    def log_artifact(
        self,
        artifact_path: str | Path,
        *,
        name: str,
        artifact_type: str = "analysis",
        metadata: dict[str, Any] | None = None,
        aliases: list[str] | None = None,
    ) -> None:
        if self._run is None:
            return

        import wandb

        path = Path(artifact_path).expanduser().resolve()
        if not path.exists():
            logger.warning("[Wandb] Artifact path does not exist: {}", path)
            return

        artifact = wandb.Artifact(name=name, type=artifact_type, metadata=metadata or {})
        if path.is_dir():
            artifact.add_dir(str(path))
        else:
            artifact.add_file(str(path), name=path.name)
        self._run.log_artifact(artifact, aliases=aliases or [])

    def finish(self) -> None:
        if self._run is not None:
            self._run.finish()
            self._run = None
