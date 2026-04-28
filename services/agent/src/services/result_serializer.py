"""Serialize runtime state into a stable JSON result payload."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from services.agent.gen.speaksure.v1 import common_pb2
from services.agent.src.state import AnalysisState


def _build_payload(state: AnalysisState) -> dict[str, Any]:
    state.result.generated_at = datetime.now(UTC).isoformat()
    state.result.status = state.status
    state.result.segment_results = [segment.model_copy(deep=True) for segment in state.segments]
    return state.model_dump(mode="json")


def build_result_payload(state: AnalysisState) -> dict[str, Any]:
    return _build_payload(state)


def build_analysis_digest(
    state: AnalysisState,
    *,
    payload: dict[str, Any] | None = None,
) -> common_pb2.AnalysisDigest:
    payload = payload or _build_payload(state)
    artifacts = payload.get("artifacts", {}) or {}

    return common_pb2.AnalysisDigest(
        request_id=payload.get("request_id", ""),
        scenario=payload.get("scenario", ""),
        transcript=payload.get("transcript", ""),
        generated_at=((payload.get("result", {}) or {}).get("generated_at", "") or ""),
        language=str((payload.get("meta", {}) or {}).get("language", "")),
        asr_mode=str((payload.get("meta", {}) or {}).get("asr_mode", "")),
        workflow_engine=str((payload.get("meta", {}) or {}).get("workflow_engine", "")),
        segment_count=len(payload.get("segments", []) or []),
        artifacts=common_pb2.ArtifactMetadata(
            asr_model_version=str(artifacts.get("asr_model_version", "")),
            lexical_model_version=str(artifacts.get("lexical_model_version", "")),
            prosody_model_version=str(artifacts.get("prosody_model_version", "")),
            disfluency_model_version=str(artifacts.get("disfluency_model_version", "")),
            config_version=str(artifacts.get("config_version", "")),
            fallback_mode=bool(artifacts.get("fallback_mode", False)),
            providers=[
                common_pb2.KeyValue(key=str(key), value=str(value))
                for key, value in sorted((artifacts.get("providers", {}) or {}).items())
            ],
            paths=[
                common_pb2.KeyValue(key=str(key), value=str(value))
                for key, value in sorted((artifacts.get("paths", {}) or {}).items())
            ],
        ),
        meta=[
            common_pb2.KeyValue(key=str(key), value=str(value))
            for key, value in sorted((payload.get("meta", {}) or {}).items())
        ],
    )


def write_result(state: AnalysisState, output_path: str | Path) -> Path:
    resolved = Path(output_path).expanduser().resolve()
    resolved.parent.mkdir(parents=True, exist_ok=True)
    payload = build_result_payload(state)
    resolved.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return resolved
