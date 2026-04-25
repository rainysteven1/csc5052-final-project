"""FastAPI transport for the agent service."""

from __future__ import annotations

import asyncio
import json
import queue
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from services.agent.src.app.usecases import (
    AnalysisEvent,
    AnalysisEventBroker,
    AnalysisJob,
    FileAnalysisJobStore,
    ReplayLoadRequest,
    build_analysis_event,
    create_analysis_job,
    load_analysis_state_from_path,
    read_analysis_result,
    run_analysis_job,
)
from services.agent.src.config import data_root
from services.agent.src.logger import logger


def _serialize_job(job: AnalysisJob) -> dict:
    payload = job.model_dump(mode="json")
    payload["status_url"] = f"/api/v1/analyses/{job.analysis_id}"
    payload["result_url"] = f"/api/v1/analyses/{job.analysis_id}/result"
    payload["events_url"] = f"/api/v1/analyses/{job.analysis_id}/events"
    return payload


def create_app(
    *,
    service_data_root: Path | None = None,
    config_path: Path | None = None,
) -> FastAPI:
    resolved_data_root = (service_data_root or data_root()).expanduser().resolve()
    uploads_root = resolved_data_root / "http_api" / "uploads"
    outputs_root = resolved_data_root / "http_api" / "results"
    jobs_root = resolved_data_root / "http_api" / "jobs"

    uploads_root.mkdir(parents=True, exist_ok=True)
    outputs_root.mkdir(parents=True, exist_ok=True)
    jobs_root.mkdir(parents=True, exist_ok=True)

    job_store = FileAnalysisJobStore(jobs_root)
    event_broker = AnalysisEventBroker()

    app = FastAPI(
        title="SpeakSure++ Agent HTTP API",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/v1/health")
    def health() -> dict:
        return {
            "status": "ok",
            "service": "speaksure-agent-http",
            "jobs_root": str(jobs_root),
            "uploads_root": str(uploads_root),
            "results_root": str(outputs_root),
        }

    @app.get("/api/v1/analyses")
    def list_analyses(limit: int = Query(default=20, ge=1, le=100)) -> dict:
        jobs = [_serialize_job(job) for job in job_store.list_jobs(limit=limit)]
        return {"items": jobs, "count": len(jobs)}

    @app.post("/api/v1/analyses", status_code=202)
    async def submit_analysis(
        background_tasks: BackgroundTasks,
        audio: UploadFile = File(...),
        scenario: str = Form("interview"),
        transcript_override: str | None = Form(None),
        upload_wandb: bool = Form(False),
    ) -> dict:
        payload = await audio.read()
        if not payload:
            raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")

        job = create_analysis_job(
            job_store=job_store,
            uploads_root=uploads_root,
            filename=audio.filename or "upload.wav",
            audio_bytes=payload,
            scenario=scenario,
            transcript_override=transcript_override,
            upload_wandb=upload_wandb,
        )
        logger.info(f"Accepted HTTP analysis job {job.analysis_id} for scenario={scenario}")
        event_broker.publish(
            build_analysis_event(
                analysis_id=job.analysis_id,
                event_type="job_created",
                status=job.status,
                total_steps=job.total_steps,
                payload={"job": job.model_dump(mode="json")},
            )
        )
        background_tasks.add_task(
            run_analysis_job,
            job_store=job_store,
            event_broker=event_broker,
            analysis_id=job.analysis_id,
            outputs_root=outputs_root,
            config_path=config_path,
        )
        return _serialize_job(job)

    @app.get("/api/v1/analyses/{analysis_id}")
    def get_analysis(analysis_id: str) -> dict:
        job = job_store.get(analysis_id)
        if job is None:
            raise HTTPException(status_code=404, detail=f"Analysis job not found: {analysis_id}")
        return _serialize_job(job)

    @app.get("/api/v1/analyses/{analysis_id}/result")
    def get_analysis_result(analysis_id: str):
        job = job_store.get(analysis_id)
        if job is None:
            raise HTTPException(status_code=404, detail=f"Analysis job not found: {analysis_id}")
        if job.status in {"queued", "running"}:
            raise HTTPException(status_code=409, detail="Analysis job is not finished yet.")

        try:
            result = read_analysis_result(job)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        return JSONResponse(
            {
                "analysis_id": analysis_id,
                "status": job.status,
                "result": result,
            }
        )

    @app.post("/api/v1/replays/load")
    def load_replay(request: ReplayLoadRequest) -> dict:
        try:
            state = load_analysis_state_from_path(request.path)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        return {
            "mode": "replay",
            "path": str(Path(request.path).expanduser().resolve()),
            "result": state.model_dump(mode="json"),
        }

    def _encode_sse(event: AnalysisEvent) -> str:
        return (
            f"id: {event.created_at}\n"
            f"event: {event.event_type}\n"
            f"data: {json.dumps(event.model_dump(mode='json'), ensure_ascii=False)}\n\n"
        )

    @app.get("/api/v1/analyses/{analysis_id}/events")
    async def stream_analysis_events(analysis_id: str, request: Request):
        job = job_store.get(analysis_id)
        if job is None:
            raise HTTPException(status_code=404, detail=f"Analysis job not found: {analysis_id}")

        history, subscriber = event_broker.subscribe(analysis_id)

        async def event_stream():
            try:
                for event in history:
                    yield _encode_sse(event)

                while True:
                    if await request.is_disconnected():
                        break
                    try:
                        event = await asyncio.to_thread(subscriber.get, True, 2)
                    except queue.Empty:
                        yield ": keep-alive\n\n"
                        continue

                    yield _encode_sse(event)
                    if event.event_type in {"analysis_completed", "analysis_failed"}:
                        break
            finally:
                event_broker.unsubscribe(analysis_id, subscriber)

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    return app
