"""HTTP-facing use cases for frontend-oriented analysis requests."""

from __future__ import annotations

import json
import queue
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from services.agent.src.app.usecases.analysis import execute_analysis
from services.agent.src.state import AnalysisState


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
    current_node: str | None = None
    completed_steps: int = 0
    total_steps: int = 11
    created_at: str = Field(default_factory=_utc_now_iso)
    updated_at: str = Field(default_factory=_utc_now_iso)


class AnalysisEvent(BaseModel):
    analysis_id: str
    event_type: str
    status: str | None = None
    node: str | None = None
    step_index: int | None = None
    total_steps: int | None = None
    progress: float | None = None
    message: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=_utc_now_iso)


class ReplayLoadRequest(BaseModel):
    path: str


class AnalysisEventBroker:
    def __init__(self) -> None:
        self._history: dict[str, list[AnalysisEvent]] = {}
        self._subscribers: dict[str, list[queue.Queue[AnalysisEvent]]] = {}
        self._lock = Lock()

    def publish(self, event: AnalysisEvent) -> AnalysisEvent:
        with self._lock:
            self._history.setdefault(event.analysis_id, []).append(event)
            for subscriber in self._subscribers.get(event.analysis_id, []):
                subscriber.put(event)
        return event

    def subscribe(self, analysis_id: str) -> tuple[list[AnalysisEvent], queue.Queue[AnalysisEvent]]:
        subscriber: queue.Queue[AnalysisEvent] = queue.Queue()
        with self._lock:
            history = list(self._history.get(analysis_id, []))
            self._subscribers.setdefault(analysis_id, []).append(subscriber)
        return history, subscriber

    def unsubscribe(self, analysis_id: str, subscriber: queue.Queue[AnalysisEvent]) -> None:
        with self._lock:
            subscribers = self._subscribers.get(analysis_id, [])
            if subscriber in subscribers:
                subscribers.remove(subscriber)
            if not subscribers and analysis_id in self._subscribers:
                self._subscribers.pop(analysis_id, None)


def _event_message(event_type: str, node: str | None = None) -> str:
    if event_type == "job_created":
        return "Analysis job created."
    if event_type == "job_running":
        return "Analysis job is now running."
    if event_type == "node_started" and node:
        return f"Started node `{node}`."
    if event_type == "node_completed" and node:
        return f"Completed node `{node}`."
    if event_type == "node_failed" and node:
        return f"Node `{node}` failed."
    if event_type == "analysis_completed":
        return "Analysis completed."
    if event_type == "analysis_failed":
        return "Analysis failed."
    return event_type.replace("_", " ").capitalize() + "."


def build_analysis_event(
    *,
    analysis_id: str,
    event_type: str,
    status: str | None = None,
    node: str | None = None,
    step_index: int | None = None,
    total_steps: int | None = None,
    progress: float | None = None,
    payload: dict[str, Any] | None = None,
    message: str | None = None,
) -> AnalysisEvent:
    resolved_progress = progress
    if resolved_progress is None and step_index is not None and total_steps:
        resolved_progress = min(max(step_index / total_steps, 0.0), 1.0)
    return AnalysisEvent(
        analysis_id=analysis_id,
        event_type=event_type,
        status=status,
        node=node,
        step_index=step_index,
        total_steps=total_steps,
        progress=resolved_progress,
        payload=payload or {},
        message=message or _event_message(event_type, node=node),
    )


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
    event_broker: AnalysisEventBroker | None = None,
    analysis_id: str,
    outputs_root: Path,
    config_path: Path | None,
) -> AnalysisJob:
    broker = event_broker or AnalysisEventBroker()
    job = job_store.get(analysis_id)
    if job is None:
        raise KeyError(f"Analysis job not found: {analysis_id}")

    job.status = "running"
    job.error = None
    job.current_node = None
    job.completed_steps = 0
    job_store.save(job)
    broker.publish(
        build_analysis_event(
            analysis_id=analysis_id,
            event_type="job_running",
            status=job.status,
            total_steps=job.total_steps,
            payload={"job": job.model_dump(mode="json")},
        )
    )

    output_path = outputs_root.expanduser().resolve() / f"{analysis_id}.{job.scenario}.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    def _progress_callback(event: dict[str, Any]) -> None:
        event_type = str(event.get("event_type") or "")
        node = str(event.get("node") or "") or None
        step_index = int(event.get("step_index") or 0) or None
        total_steps = int(event.get("total_steps") or job.total_steps) or job.total_steps
        payload = event.get("payload")
        if isinstance(payload, dict):
            event_payload = payload
        else:
            event_payload = {}

        if node is not None:
            job.current_node = node
        if event_type == "node_completed" and step_index is not None:
            job.completed_steps = max(job.completed_steps, step_index)
        job.total_steps = total_steps
        job_store.save(job)
        broker.publish(
            build_analysis_event(
                analysis_id=analysis_id,
                event_type=event_type,
                status=str(event.get("status") or job.status),
                node=node,
                step_index=step_index,
                total_steps=total_steps,
                progress=float(event.get("progress")) if event.get("progress") is not None else None,
                payload={
                    "job": job.model_dump(mode="json"),
                    **event_payload,
                },
            )
        )

    try:
        execution = execute_analysis(
            audio=Path(job.audio_path),
            scenario=job.scenario,
            output=output_path,
            config_path=config_path,
            transcript_override=job.transcript_override,
            progress_callback=_progress_callback,
        )
    except Exception as exc:
        job.error = str(exc)
        job.status = "failed"
        saved_job = job_store.save(job)
        broker.publish(
            build_analysis_event(
                analysis_id=analysis_id,
                event_type="analysis_failed",
                status=saved_job.status,
                total_steps=saved_job.total_steps,
                payload={"job": saved_job.model_dump(mode="json"), "error": saved_job.error},
            )
        )
        return saved_job

    job.result_path = str(execution.result_path)
    job.warnings = list(execution.state.warnings)
    job.overall_score = execution.state.result.overall_score
    job.level = execution.state.result.level
    job.summary = execution.state.result.summary
    job.dominant_causes = list(execution.state.result.dominant_causes)
    job.error = execution.error
    job.status = "failed" if execution.error else "completed"
    job.current_node = "serialize_result"
    job.completed_steps = job.total_steps
    saved_job = job_store.save(job)
    broker.publish(
        build_analysis_event(
            analysis_id=analysis_id,
            event_type="analysis_failed" if execution.error else "analysis_completed",
            status=saved_job.status,
            node=saved_job.current_node,
            step_index=saved_job.completed_steps,
            total_steps=saved_job.total_steps,
            payload={
                "job": saved_job.model_dump(mode="json"),
                "result": execution.state.model_dump(mode="json"),
                "result_path": str(execution.result_path),
            },
        )
    )
    return saved_job


def read_analysis_result(job: AnalysisJob) -> dict:
    if not job.result_path:
        raise FileNotFoundError(f"No result recorded for analysis {job.analysis_id}")

    result_path = Path(job.result_path).expanduser().resolve()
    if not result_path.exists():
        raise FileNotFoundError(f"Result file not found for analysis {job.analysis_id}: {result_path}")

    return json.loads(result_path.read_text(encoding="utf-8"))


def load_analysis_state_from_path(path: str | Path) -> AnalysisState:
    result_path = Path(path).expanduser().resolve()
    if not result_path.exists():
        raise FileNotFoundError(f"Replay result not found: {result_path}")
    return AnalysisState.model_validate_json(result_path.read_text(encoding="utf-8"))
