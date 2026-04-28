"""Use cases for calling the agent service over gRPC."""

from __future__ import annotations

import json
from pathlib import Path

from services.agent.src.app.usecases.analysis import AnalysisExecutionResult, BatchExportResult
from services.agent.src.state import AnalysisState, build_initial_state
from services.agent.src.transports.grpc_client import AgentGrpcError, analyze_via_grpc


def resolve_agent_grpc_target(*, artifacts) -> str | None:
    target = str(artifacts.metadata.paths.get("agent_grpc_target", "")).strip()
    return target or None


def _kv_list_to_dict(items) -> dict[str, str]:
    return {str(item.key): str(item.value) for item in items}


def _build_state_from_digest(response, *, audio: Path, scenario: str) -> AnalysisState:
    digest = response.digest
    state = build_initial_state(audio_path=audio, scenario=digest.scenario or scenario)
    state.request_id = digest.request_id or state.request_id
    state.status = response.status or state.status
    state.transcript = digest.transcript or ""
    state.warnings = list(response.warnings)
    state.errors = list(response.errors)

    state.result.overall_score = response.overall_score
    state.result.level = response.level or None
    state.result.summary = response.summary or None
    state.result.dominant_causes = list(response.dominant_causes)
    state.result.generated_at = digest.generated_at or state.result.generated_at

    state.artifacts.asr_model_version = digest.artifacts.asr_model_version or state.artifacts.asr_model_version
    state.artifacts.lexical_model_version = (
        digest.artifacts.lexical_model_version or state.artifacts.lexical_model_version
    )
    state.artifacts.prosody_model_version = (
        digest.artifacts.prosody_model_version or state.artifacts.prosody_model_version
    )
    state.artifacts.disfluency_model_version = (
        digest.artifacts.disfluency_model_version or state.artifacts.disfluency_model_version
    )
    state.artifacts.config_version = digest.artifacts.config_version or state.artifacts.config_version
    state.artifacts.fallback_mode = digest.artifacts.fallback_mode
    state.artifacts.providers = _kv_list_to_dict(digest.artifacts.providers)
    state.artifacts.paths = _kv_list_to_dict(digest.artifacts.paths)

    state.meta = _kv_list_to_dict(digest.meta)
    if digest.language and "language" not in state.meta:
        state.meta["language"] = digest.language
    if digest.asr_mode and "asr_mode" not in state.meta:
        state.meta["asr_mode"] = digest.asr_mode
    if digest.workflow_engine and "workflow_engine" not in state.meta:
        state.meta["workflow_engine"] = digest.workflow_engine

    return state


def execute_analysis_via_grpc(
    *,
    grpc_target: str,
    audio: Path,
    scenario: str,
    output: Path,
    config_path: Path | None,
    transcript_override: str | None = None,
    prompt_language_override: str | None = None,
    upload_wandb: bool = False,
) -> AnalysisExecutionResult:
    try:
        response = analyze_via_grpc(
            grpc_target=grpc_target,
            audio_path=audio,
            scenario=scenario,
            output_path=output,
            transcript_override=transcript_override,
            prompt_language_override=prompt_language_override,
            config_path=config_path,
            upload_wandb=upload_wandb,
        )
    except AgentGrpcError as exc:
        fallback_state = build_initial_state(audio_path=audio, scenario=scenario)
        fallback_state.status = "failed"
        fallback_state.add_error(str(exc))
        return AnalysisExecutionResult(state=fallback_state, result_path=output, error=str(exc))

    payload = json.loads(response.result_json) if response.result_json else {}
    state = (
        AnalysisState.model_validate(payload)
        if payload
        else _build_state_from_digest(response, audio=audio, scenario=scenario)
    )
    if prompt_language_override and "prompt_language_override" not in state.meta:
        state.meta["prompt_language_override"] = prompt_language_override
    error = response.errors[0] if response.errors else None
    return AnalysisExecutionResult(
        state=state,
        result_path=Path(response.result_path).expanduser().resolve() if response.result_path else output,
        error=error,
    )


def export_sample_analyses_via_grpc(
    *,
    grpc_target: str,
    audio_files: list[Path],
    scenario: str,
    output_dir: Path,
    config_path: Path | None,
    repo_root: Path,
    upload_wandb: bool = False,
) -> BatchExportResult:
    from services.agent.src.app.usecases.analysis import format_output_reference, truncate_text

    rows: list[dict[str, str]] = []
    failure_count = 0

    for audio_path in audio_files:
        execution = execute_analysis_via_grpc(
            grpc_target=grpc_target,
            audio=audio_path,
            scenario=scenario,
            output=output_dir / f"{audio_path.stem}.{scenario}.json",
            config_path=config_path,
            upload_wandb=upload_wandb,
        )
        if execution.error:
            failure_count += 1

        result_state = execution.state
        rows.append(
            {
                "audio": audio_path.name,
                "language": str(result_state.meta.get("language", "")),
                "status": result_state.status,
                "overall_score": (
                    f"{result_state.result.overall_score:.3f}"
                    if result_state.result.overall_score is not None
                    else "n/a"
                ),
                "level": result_state.result.level or "n/a",
                "dominant_causes": ",".join(result_state.result.dominant_causes) or "-",
                "transcript": truncate_text(result_state.transcript),
                "output": format_output_reference(execution.result_path, repo_root=repo_root),
            }
        )

    return BatchExportResult(rows=rows, failure_count=failure_count)
