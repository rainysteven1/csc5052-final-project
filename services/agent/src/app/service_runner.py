"""Process runners for the agent service transports."""

from __future__ import annotations

from services.agent.src.logger import logger
from services.agent.src.services.artifact_loader import resolve_agent_grpc_bind
from services.agent.src.transports.grpc_server import serve_grpc


def run_agent_grpc_server() -> None:
    bind = resolve_agent_grpc_bind()
    logger.info(f"Starting agent gRPC server on {bind}")
    server = serve_grpc(bind=bind)
    server.wait_for_termination()
