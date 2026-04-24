"""HTTP-facing use cases for frontend-oriented analysis requests."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from services.agent.src.app.usecases.analysis import execute_analysis


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


class AnalysisJob(BaseModel):
    analysis_id: str
    status: Literal["queued", "running", "completed", "failed"] = "queued"
    scenario: str
    audio_filename: str
    audio_path: str
    transcript_override: str | None = None
    upload_wandb: bool = False
    result_path: str | None = None
    error: str | None = None
    warnings: list[str] = Field(default_factory=list)
    overall_score: float | None = None
    level: str | None = None
    summary: str | None = None
    dominant_causes: list[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=_utc_now_iso)
    updated_at: str = Field(default_factory=_utc_now_iso)


class FileAnalysisJobStore:
    def __init__(self, root: Path):
        self.root = root.expanduser().resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()

    def _job_path(self, analysis_id: str) -> Path:
        return self.root / f"{analysis_id}.json"

    def save(self, job: AnalysisJob) -> AnalysisJob:
        job.updated_at = _utc_now_iso()
        with self._lock:
            self._job_path(job.analysis_id).write_text(
                json.dumps(job.model_dump(mode="json"), ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        return job

    def get(self, analysis_id: str) -> AnalysisJob | None:
        path = self._job_path(analysis_id)
        if not path.exists():
            return None
        return AnalysisJob.model_validate_json(path.read_text(encoding="utf-8"))

    def list_jobs(self, *, limit: int = 20) -> list[AnalysisJob]:
        jobs = [
            AnalysisJob.model_validate_json(path.read_text(encoding="utf-8"))
            for path in sorted(self.root.glob("*.json"), reverse=True)
        ]
        return jobs[:limit]


def create_analysis_job(
    *,
    job_store: FileAnalysisJobStore,
    uploads_root: Path,
    filename: str,
    audio_bytes: bytes,
    scenario: str,
    transcript_override: str | None = None,
    upload_wandb: bool = False,
) -> AnalysisJob:
    analysis_id = f"analysis_{uuid4().hex[:12]}"
    safe_name = Path(filename or "upload.wav").name or "upload.wav"
    upload_dir = uploads_root.expanduser().resolve() / analysis_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    audio_path = upload_dir / safe_name
    audio_path.write_bytes(audio_bytes)

    job = AnalysisJob(
        analysis_id=analysis_id,
        scenario=scenario,
        audio_filename=safe_name,
        audio_path=str(audio_path),
        transcript_override=transcript_override,
        upload_wandb=upload_wandb,
    )
    return job_store.save(job)


def run_analysis_job(
    *,
    job_store: FileAnalysisJobStore,
    analysis_id: str,
    outputs_root: Path,
    config_path: Path | None,
) -> AnalysisJob:
    job = job_store.get(analysis_id)
    if job is None:
        raise KeyError(f"Analysis job not found: {analysis_id}")

    job.status = "running"
    job.error = None
    job_store.save(job)

    output_path = outputs_root.expanduser().resolve() / f"{analysis_id}.{job.scenario}.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        execution = execute_analysis(
            audio=Path(job.audio_path),
            scenario=job.scenario,
            output=output_path,
            config_path=config_path,
            transcript_override=job.transcript_override,
        )
    except Exception as exc:
        job.error = str(exc)
        job.status = "failed"
        return job_store.save(job)

    job.result_path = str(execution.result_path)
    job.warnings = list(execution.state.warnings)
    job.overall_score = execution.state.result.overall_score
    job.level = execution.state.result.level
    job.summary = execution.state.result.summary
    job.dominant_causes = list(execution.state.result.dominant_causes)
    job.error = execution.error
    job.status = "failed" if execution.error else "completed"
    return job_store.save(job)


def read_analysis_result(job: AnalysisJob) -> dict:
    if not job.result_path:
        raise FileNotFoundError(f"No result recorded for analysis {job.analysis_id}")

    result_path = Path(job.result_path).expanduser().resolve()
    if not result_path.exists():
        raise FileNotFoundError(f"Result file not found for analysis {job.analysis_id}: {result_path}")

    return json.loads(result_path.read_text(encoding="utf-8"))
