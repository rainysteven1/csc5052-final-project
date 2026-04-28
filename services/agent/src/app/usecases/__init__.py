"""CLI use cases for the agent application layer."""

from services.agent.src.app.usecases.agent_grpc import (
    execute_analysis_via_grpc,
    export_sample_analyses_via_grpc,
    resolve_agent_grpc_target,
)
from services.agent.src.app.usecases.analysis import (
    AnalysisExecutionResult,
    BatchExportResult,
    build_samples_summary,
    discover_audio_files,
    execute_analysis,
    export_sample_analyses,
    load_runtime_artifacts,
    read_transcript_override,
)
from services.agent.src.app.usecases.wandb_upload import (
    upload_batch_run_to_wandb,
    upload_single_run_to_wandb,
)

__all__ = [
    "AnalysisExecutionResult",
    "BatchExportResult",
    "build_samples_summary",
    "discover_audio_files",
    "execute_analysis",
    "execute_analysis_via_grpc",
    "export_sample_analyses",
    "export_sample_analyses_via_grpc",
    "load_runtime_artifacts",
    "read_transcript_override",
    "resolve_agent_grpc_target",
    "upload_batch_run_to_wandb",
    "upload_single_run_to_wandb",
]
