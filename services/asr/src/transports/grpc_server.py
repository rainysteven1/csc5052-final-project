"""gRPC server for the ASR microservice."""

from __future__ import annotations

from concurrent import futures

import grpc
from grpc_health.v1 import health, health_pb2, health_pb2_grpc
from grpc_reflection.v1alpha import reflection

from services.asr.src.service import transcribe_audio_file
from services.gen.speaksure.v1 import asr_service_pb2, asr_service_pb2_grpc, common_pb2

ASR_SERVICE_NAME = asr_service_pb2.DESCRIPTOR.services_by_name["AsrService"].full_name


class AsrServiceGrpcServicer(asr_service_pb2_grpc.AsrServiceServicer):
    def Transcribe(self, request, context):  # noqa: N802
        try:
            result = transcribe_audio_file(
                request.audio_path,
                scenario=request.scenario,
                provider="local",
                api_url=request.api_url,
                language_hint=request.language_hint or None,
                transcript_override=request.transcript_override or None,
            )
        except FileNotFoundError as exc:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(str(exc))
            return asr_service_pb2.TranscribeResponse()
        except Exception as exc:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(exc))
            return asr_service_pb2.TranscribeResponse()

        metadata = [common_pb2.KeyValue(key=str(k), value=str(v)) for k, v in result.metadata.items()]
        return asr_service_pb2.TranscribeResponse(
            transcript=result.transcript,
            provider="grpc",
            response_model=str(result.metadata.get("response_model", "")),
            language=str(result.metadata.get("language", request.language_hint or "")),
            warnings=result.warnings,
            metadata=metadata,
        )


def _register_health(server: grpc.Server) -> None:
    health_servicer = health.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    for service_name in ("", ASR_SERVICE_NAME, health.SERVICE_NAME):
        health_servicer.set(service_name, health_pb2.HealthCheckResponse.SERVING)


def _enable_reflection(server: grpc.Server) -> None:
    reflection.enable_server_reflection(
        (
            ASR_SERVICE_NAME,
            health.SERVICE_NAME,
            reflection.SERVICE_NAME,
        ),
        server,
    )


def serve_grpc(bind: str = "127.0.0.1:50052"):
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    asr_service_pb2_grpc.add_AsrServiceServicer_to_server(AsrServiceGrpcServicer(), server)
    _register_health(server)
    _enable_reflection(server)
    server.add_insecure_port(bind)
    server.start()
    return server
