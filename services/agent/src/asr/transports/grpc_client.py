"""Optional gRPC client for calling an upstream ASR runtime."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from services.agent.gen.speaksure.v1 import asr_service_pb2, asr_service_pb2_grpc
from services.agent.src.asr.remote_api import RemoteAsrError

try:
    import grpc
except ImportError:  # pragma: no cover - dependency wiring
    grpc = None


def transcribe_with_grpc_asr(
    audio_path: str | Path,
    *,
    grpc_target: str,
    scenario: str,
    language_hint: str | None = None,
) -> tuple[str, dict[str, Any]]:
    if grpc is None:  # pragma: no cover - dependency wiring
        raise RemoteAsrError("grpcio is not installed in the runtime environment.")
    if not grpc_target.strip():
        raise RemoteAsrError("ASR gRPC target is empty.")

    resolved_audio = Path(audio_path).expanduser().resolve()
    request = asr_service_pb2.TranscribeRequest(
        audio_path=str(resolved_audio),
        scenario=scenario,
        language_hint=language_hint or "",
        provider="grpc",
    )

    try:
        with grpc.insecure_channel(grpc_target) as channel:
            stub = asr_service_pb2_grpc.AsrServiceStub(channel)
            response = stub.Transcribe(request)
    except Exception as exc:  # pragma: no cover - network path
        raise RemoteAsrError(f"ASR gRPC request failed: {exc}") from exc

    transcript = response.transcript.strip()
    if not transcript:
        raise RemoteAsrError("ASR gRPC response returned an empty transcript.")

    metadata = {
        "provider": response.provider or "grpc",
        "response_model": response.response_model or "",
        "language": response.language or language_hint or "",
    }
    return transcript, metadata
