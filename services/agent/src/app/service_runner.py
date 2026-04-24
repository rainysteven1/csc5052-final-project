"""Process runners for the agent service transports."""

from __future__ import annotations

import uvicorn

from services.agent.src.logger import logger
from services.agent.src.services.artifact_loader import resolve_agent_grpc_bind, resolve_agent_http_bind
from services.agent.src.transports.grpc_server import serve_grpc
from services.agent.src.transports.http_server import create_app


def _parse_bind(bind: str) -> tuple[str, int]:
    host, _, port_str = bind.rpartition(":")
    if not host or not port_str:
        raise ValueError(f"Invalid HTTP bind address: {bind}")
    return host, int(port_str)


def run_agent_grpc_server() -> None:
    bind = resolve_agent_grpc_bind()
    logger.info(f"Starting agent gRPC server on {bind}")
    server = serve_grpc(bind=bind)
    server.wait_for_termination()


def run_agent_http_server() -> None:
    bind = resolve_agent_http_bind()
    host, port = _parse_bind(bind)
    logger.info(f"Starting agent HTTP server on {bind}")
    uvicorn.run(create_app(), host=host, port=port, log_level="info")
