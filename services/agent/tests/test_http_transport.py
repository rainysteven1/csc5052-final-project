from __future__ import annotations

import wave
from pathlib import Path

from services.agent.src.app.usecases.http_api import (
    FileAnalysisJobStore,
    create_analysis_job,
    read_analysis_result,
    run_analysis_job,
)
from services.agent.src.transports.http_server import create_app


def _write_silence_wav(path: Path, *, sample_rate: int = 16000, duration_seconds: float = 0.25) -> None:
    frame_count = int(sample_rate * duration_seconds)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        handle.writeframes(b"\x00\x00" * frame_count)


def test_http_app_registers_expected_rest_routes(tmp_path: Path) -> None:
    app = create_app(service_data_root=tmp_path)
    route_paths = {route.path for route in app.routes}

    assert "/api/v1/health" in route_paths
    assert "/api/v1/analyses" in route_paths
    assert "/api/v1/analyses/{analysis_id}" in route_paths
    assert "/api/v1/analyses/{analysis_id}/result" in route_paths


def test_http_job_flow_persists_status_and_result(tmp_path: Path) -> None:
    audio_path = tmp_path / "demo.wav"
    _write_silence_wav(audio_path)

    uploads_root = tmp_path / "uploads"
    outputs_root = tmp_path / "outputs"
    job_store = FileAnalysisJobStore(tmp_path / "jobs")

    job = create_analysis_job(
        job_store=job_store,
        uploads_root=uploads_root,
        filename=audio_path.name,
        audio_bytes=audio_path.read_bytes(),
        scenario="interview",
        transcript_override="This is an HTTP transport transcript override.",
    )

    assert job.status == "queued"
    assert Path(job.audio_path).exists()

    completed = run_analysis_job(
        job_store=job_store,
        analysis_id=job.analysis_id,
        outputs_root=outputs_root,
        config_path=None,
    )

    assert completed.status == "completed"
    assert completed.result_path is not None
    assert Path(completed.result_path).exists()
    assert completed.overall_score is not None

    stored = job_store.get(job.analysis_id)
    assert stored is not None
    assert stored.status == "completed"
    assert stored.summary

    result = read_analysis_result(stored)
    assert result["transcript"] == "This is an HTTP transport transcript override."
