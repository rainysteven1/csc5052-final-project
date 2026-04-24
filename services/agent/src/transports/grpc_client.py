"""gRPC client for calling the agent analysis microservice."""

from __future__ import annotations

from pathlib import Path

try:
    import grpc
except ImportError:  # pragma: no cover - dependency wiring
    grpc = None

from services.gen.speaksure.v1 import agent_service_pb2, agent_service_pb2_grpc


class AgentGrpcError(RuntimeError):
    """Raised when the agent gRPC service fails."""


def analyze_via_grpc(
    *,
    grpc_target: str,
    audio_path: str | Path,
    scenario: str,
    output_path: str | Path | None = None,
    transcript_override: str | None = None,
    config_path: str | Path | None = None,
    upload_wandb: bool = False,
):
    if grpc is None:  # pragma: no cover - dependency wiring
        raise AgentGrpcError("grpcio is not installed in the runtime environment.")
    if not grpc_target.strip():
        raise AgentGrpcError("Agent gRPC target is empty.")

    request = agent_service_pb2.AnalyzeRequest(
        audio_path=str(Path(audio_path).expanduser().resolve()),
        scenario=scenario,
        output_path=str(Path(output_path).expanduser().resolve()) if output_path else "",
        transcript_override=transcript_override or "",
        config_path=str(Path(config_path).expanduser().resolve()) if config_path else "",
        upload_wandb=upload_wandb,
    )
    try:
        with grpc.insecure_channel(grpc_target) as channel:
            stub = agent_service_pb2_grpc.AgentServiceStub(channel)
            return stub.Analyze(request)
    except Exception as exc:  # pragma: no cover - network path
        raise AgentGrpcError(f"Agent gRPC request failed: {exc}") from exc
