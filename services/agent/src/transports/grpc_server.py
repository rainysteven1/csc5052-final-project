"""gRPC server for the agent analysis microservice."""

from __future__ import annotations

import json
from concurrent import futures
from pathlib import Path

import grpc
from grpc_health.v1 import health, health_pb2, health_pb2_grpc
from grpc_reflection.v1alpha import reflection

from services.agent.src.app.usecases.analysis import execute_analysis
from services.agent.src.app.usecases.wandb_upload import upload_single_run_to_wandb
from services.agent.src.services.result_serializer import build_analysis_digest, build_result_payload
from services.gen.speaksure.v1 import agent_service_pb2, agent_service_pb2_grpc

AGENT_SERVICE_NAME = agent_service_pb2.DESCRIPTOR.services_by_name["AgentService"].full_name


class AgentServiceGrpcServicer(agent_service_pb2_grpc.AgentServiceServicer):
    def Analyze(self, request, context):  # noqa: N802
        output_path = Path(request.output_path).expanduser().resolve() if request.output_path else None
        if output_path is None:
            audio_stem = Path(request.audio_path).stem or "analysis"
            output_path = Path.cwd() / f"{audio_stem}.{request.scenario or 'interview'}.json"

        execution = execute_analysis(
            audio=Path(request.audio_path).expanduser().resolve(),
            scenario=request.scenario or "interview",
            output=output_path,
            config_path=Path(request.config_path).expanduser().resolve() if request.config_path else None,
            transcript_override=request.transcript_override or None,
        )
        if request.upload_wandb and not execution.error:
            upload_single_run_to_wandb(
                state=execution.state,
                result_path=execution.result_path,
                audio=Path(request.audio_path).expanduser().resolve(),
                scenario=request.scenario or "interview",
                config_path=Path(request.config_path).expanduser().resolve() if request.config_path else None,
            )

        payload = build_result_payload(execution.state)
        return agent_service_pb2.AnalyzeResponse(
            status=execution.state.status,
            result_json=json.dumps(payload, ensure_ascii=False),
            result_path=str(execution.result_path),
            overall_score=float(execution.state.result.overall_score or 0.0),
            level=execution.state.result.level or "",
            summary=execution.state.result.summary or "",
            dominant_causes=execution.state.result.dominant_causes,
            warnings=execution.state.warnings,
            errors=execution.state.errors,
            digest=build_analysis_digest(execution.state, payload=payload),
        )


def _register_health(server: grpc.Server) -> None:
    health_servicer = health.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    for service_name in ("", AGENT_SERVICE_NAME, health.SERVICE_NAME):
        health_servicer.set(service_name, health_pb2.HealthCheckResponse.SERVING)


def _enable_reflection(server: grpc.Server) -> None:
    reflection.enable_server_reflection(
        (
            AGENT_SERVICE_NAME,
            health.SERVICE_NAME,
            reflection.SERVICE_NAME,
        ),
        server,
    )


def serve_grpc(bind: str = "127.0.0.1:50051"):
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    agent_service_pb2_grpc.add_AgentServiceServicer_to_server(AgentServiceGrpcServicer(), server)
    _register_health(server)
    _enable_reflection(server)
    server.add_insecure_port(bind)
    server.start()
    return server
