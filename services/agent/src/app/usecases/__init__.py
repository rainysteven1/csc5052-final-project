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
from services.agent.src.app.usecases.http_api import (
    AnalysisEvent,
    AnalysisEventBroker,
    AnalysisJob,
    ReplayLoadRequest,
    FileAnalysisJobStore,
    build_analysis_event,
    create_analysis_job,
    load_analysis_state_from_path,
    read_analysis_result,
    run_analysis_job,
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
    "AnalysisEvent",
    "AnalysisEventBroker",
    "AnalysisJob",
    "ReplayLoadRequest",
    "FileAnalysisJobStore",
    "build_analysis_event",
    "load_runtime_artifacts",
    "create_analysis_job",
    "load_analysis_state_from_path",
    "read_analysis_result",
    "read_transcript_override",
    "resolve_agent_grpc_target",
    "run_analysis_job",
    "upload_batch_run_to_wandb",
    "upload_single_run_to_wandb",
]
