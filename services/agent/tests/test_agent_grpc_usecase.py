from __future__ import annotations

from pathlib import Path

from services.agent.src.app.usecases.agent_grpc import execute_analysis_via_grpc
from services.gen.speaksure.v1 import agent_service_pb2, common_pb2


def test_execute_analysis_via_grpc_can_fall_back_to_digest(monkeypatch, tmp_path: Path) -> None:
    audio_path = tmp_path / "demo.wav"
    output_path = tmp_path / "demo.json"
    audio_path.write_bytes(b"RIFFdemo")

    def _fake_analyze_via_grpc(**_kwargs):
        return agent_service_pb2.AnalyzeResponse(
            status="completed",
            result_path=str(output_path),
            overall_score=0.82,
            level="B2",
            summary="Digest-only summary",
            dominant_causes=["disfluency"],
            warnings=["digest warning"],
            digest=common_pb2.AnalysisDigest(
                request_id="req_digest_001",
                scenario="interview",
                transcript="Transcript from digest",
                generated_at="2026-04-24T10:00:00Z",
                language="en",
                asr_mode="grpc",
                workflow_engine="langgraph",
                segment_count=3,
                artifacts=common_pb2.ArtifactMetadata(
                    asr_model_version="grpc-asr-v1",
                    lexical_model_version="rule-v1",
                    prosody_model_version="rule-v1",
                    disfluency_model_version="rule-v1",
                    config_version="config.toml",
                    fallback_mode=False,
                    providers=[common_pb2.KeyValue(key="asr", value="grpc")],
                    paths=[common_pb2.KeyValue(key="asr_grpc_target", value="127.0.0.1:50052")],
                ),
                meta=[
                    common_pb2.KeyValue(key="language", value="en"),
                    common_pb2.KeyValue(key="asr_mode", value="grpc"),
                    common_pb2.KeyValue(key="workflow_engine", value="langgraph"),
                ],
            ),
        )

    monkeypatch.setattr("services.agent.src.app.usecases.agent_grpc.analyze_via_grpc", _fake_analyze_via_grpc)

    execution = execute_analysis_via_grpc(
        grpc_target="127.0.0.1:50051",
        audio=audio_path,
        scenario="interview",
        output=output_path,
        config_path=None,
    )

    assert execution.error is None
    assert execution.state.request_id == "req_digest_001"
    assert execution.state.status == "completed"
    assert execution.state.transcript == "Transcript from digest"
    assert execution.state.result.overall_score == 0.82
    assert execution.state.result.level == "B2"
    assert execution.state.result.summary == "Digest-only summary"
    assert execution.state.result.dominant_causes == ["disfluency"]
    assert execution.state.meta["language"] == "en"
    assert execution.state.meta["asr_mode"] == "grpc"
    assert execution.state.meta["workflow_engine"] == "langgraph"
    assert execution.state.artifacts.providers["asr"] == "grpc"
    assert execution.state.artifacts.paths["asr_grpc_target"] == "127.0.0.1:50052"
