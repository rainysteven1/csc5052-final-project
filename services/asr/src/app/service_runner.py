"""Process runner for the ASR gRPC service."""

from __future__ import annotations

from services.agent.src.logger import logger
from services.agent.src.services.artifact_loader import resolve_asr_grpc_bind
from services.asr.src.transports.grpc_server import serve_grpc


def run_asr_grpc_server() -> None:
    bind = resolve_asr_grpc_bind()
    logger.info(f"Starting ASR gRPC server on {bind}")
    server = serve_grpc(bind=bind)
    server.wait_for_termination()
