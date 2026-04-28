"""Internal backend routing for the agent-owned ASR runtime."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from services.agent.src.config import repo_root
from services.agent.src.services.artifact_loader import read_speaksure_section

WHISPER_ONNX_REQUIRED_FILES = (
    "onnx/encoder_model_int8.onnx",
    "onnx/decoder_model_merged_int8.onnx",
)


@dataclass(frozen=True)
class AsrBackendConfig:
    backend: str = "stub"
    grpc_target: str = ""
    onnx_model_dir: str = ""


def resolve_asr_backend_config(config_path: str | Path | None = None) -> AsrBackendConfig:
    section = read_speaksure_section(config_path)
    runtime_section = section.get("runtime", {}) if isinstance(section.get("runtime"), dict) else {}

    backend = str(runtime_section.get("asr_backend", "")).strip() or "stub"
    grpc_target = str(runtime_section.get("asr_backend_grpc_target", "")).strip()
    onnx_model_dir = str(runtime_section.get("asr_onnx_model_dir", "")).strip()

    return AsrBackendConfig(
        backend=backend,
        grpc_target=grpc_target,
        onnx_model_dir=onnx_model_dir,
    )


def resolve_onnx_model_dir(raw_path: str) -> Path:
    candidate = Path(raw_path).expanduser()
    if candidate.is_absolute():
        return candidate.resolve()
    return (repo_root() / candidate).resolve()


def missing_whisper_onnx_files(raw_path: str) -> tuple[Path, list[str]]:
    model_dir = resolve_onnx_model_dir(raw_path)
    missing: list[str] = []
    if not model_dir.exists():
        return model_dir, list(WHISPER_ONNX_REQUIRED_FILES)

    for relative_path in WHISPER_ONNX_REQUIRED_FILES:
        if not (model_dir / relative_path).exists():
            missing.append(relative_path)
    return model_dir, missing
