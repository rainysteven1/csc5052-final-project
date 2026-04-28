from __future__ import annotations

from pathlib import Path

from services.agent.src.asr.config import resolve_asr_backend_config
from services.agent.src.config import (
    data_root,
    default_config_path,
    get_config,
    init_config,
    load_config,
    repo_root,
    runtime_root,
    service_root,
)
from services.agent.src.services.artifact_loader import (
    load_artifacts,
    resolve_agent_grpc_bind,
    resolve_asr_grpc_bind,
)


def test_load_config_reads_runtime_settings() -> None:
    cfg = load_config()

    assert cfg.seed == 42
    assert "runtime" in cfg.speaksure
    assert "contexts" in cfg.speaksure


def test_init_config_sets_singleton_instance() -> None:
    cfg = init_config()

    assert get_config() is cfg


def test_service_and_repo_roots_are_distinct() -> None:
    assert service_root() == repo_root() / "services" / "agent"
    assert service_root() != repo_root()
    assert runtime_root() == service_root()
    assert data_root() == service_root() / "data"


def test_default_config_path_points_to_service_config() -> None:
    assert default_config_path() == service_root() / "config" / "config.toml"


def test_load_artifacts_uses_configured_local_asr_by_default() -> None:
    artifacts = load_artifacts()

    assert artifacts.metadata.providers["asr"] == "local"
    assert artifacts.warnings == []


def test_load_artifacts_warns_when_api_provider_has_no_url(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.delenv("SPEAKSURE_ASR_PROVIDER", raising=False)
    config_path = tmp_path / "runtime.toml"
    config_path.write_text(
        """
[speaksure.runtime]
asr_provider = "api"
""".strip(),
        encoding="utf-8",
    )

    artifacts = load_artifacts(config_path)

    assert artifacts.warnings
    assert "asr_api_url" in artifacts.warnings[0]


def test_load_artifacts_warns_when_grpc_provider_has_no_target(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.delenv("SPEAKSURE_ASR_PROVIDER", raising=False)
    config_path = tmp_path / "runtime.toml"
    config_path.write_text(
        """
[speaksure.runtime]
asr_provider = "grpc"
""".strip(),
        encoding="utf-8",
    )

    artifacts = load_artifacts(config_path)

    assert artifacts.warnings
    assert "asr_grpc_target" in artifacts.warnings[0]


def test_load_artifacts_applies_runtime_env_overrides(tmp_path: Path, monkeypatch) -> None:
    config_path = tmp_path / "runtime.toml"
    config_path.write_text(
        """
[speaksure.runtime]
asr_provider = "grpc"
asr_grpc_target = "127.0.0.1:50052"
""".strip(),
        encoding="utf-8",
    )

    monkeypatch.setenv("SPEAKSURE_ASR_PROVIDER", "local")

    artifacts = load_artifacts(config_path)

    assert artifacts.metadata.providers["asr"] == "local"


def test_resolve_asr_backend_config_reads_static_runtime_backend(tmp_path: Path) -> None:
    config_path = tmp_path / "runtime.toml"
    config_path.write_text(
        """
[speaksure.runtime]
asr_backend = "onnx"
asr_backend_grpc_target = "127.0.0.1:60052"
asr_onnx_model_dir = "services/agent/models/asr/whisper"
""".strip(),
        encoding="utf-8",
    )

    backend = resolve_asr_backend_config(config_path)

    assert backend.backend == "onnx"
    assert backend.grpc_target == "127.0.0.1:60052"
    assert backend.onnx_model_dir == "services/agent/models/asr/whisper"


def test_resolve_grpc_binds_fall_back_to_defaults() -> None:
    assert resolve_agent_grpc_bind() == "127.0.0.1:50051"
    assert resolve_asr_grpc_bind() == "127.0.0.1:50052"


def test_resolve_grpc_binds_from_config(tmp_path: Path) -> None:
    config_path = tmp_path / "runtime.toml"
    config_path.write_text(
        """
[speaksure.runtime]
agent_grpc_bind = "0.0.0.0:60051"
asr_grpc_bind = "0.0.0.0:60052"
""".strip(),
        encoding="utf-8",
    )

    assert resolve_agent_grpc_bind(config_path) == "0.0.0.0:60051"
    assert resolve_asr_grpc_bind(config_path) == "0.0.0.0:60052"
