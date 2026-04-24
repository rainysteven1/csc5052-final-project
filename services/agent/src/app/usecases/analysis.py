"""CLI-facing analysis and batch export use cases."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from services.agent.src.services.artifact_loader import ArtifactBundle, load_artifacts
from services.agent.src.services.audio_preprocess import SUPPORTED_AUDIO_EXTENSIONS
from services.agent.src.services.result_serializer import write_result
from services.agent.src.state import AnalysisState, build_initial_state
from services.agent.src.workflow import WorkflowExecutionError, build_inference_workflow


@dataclass
class AnalysisExecutionResult:
    state: AnalysisState
    result_path: Path
    error: str | None = None


@dataclass
class BatchExportResult:
    rows: list[dict[str, str]]
    failure_count: int


def read_transcript_override(transcript_file: Path | None) -> str | None:
    if transcript_file is None:
        return None
    return transcript_file.read_text(encoding="utf-8").strip()


def load_runtime_artifacts(
    config_path: Path | None,
    *,
    manifest_path: Path | None = None,
) -> ArtifactBundle:
    overrides: dict[str, str] | None = None
    if manifest_path is not None:
        overrides = {"transcription_manifest_path": str(manifest_path.expanduser().resolve())}
    return load_artifacts(config_path=config_path, overrides=overrides)


def execute_analysis(
    *,
    audio: Path,
    scenario: str,
    output: Path,
    config_path: Path | None,
    transcript_override: str | None = None,
    artifacts: ArtifactBundle | None = None,
) -> AnalysisExecutionResult:
    resolved_artifacts = artifacts or load_runtime_artifacts(config_path)
    workflow = build_inference_workflow(
        artifacts=resolved_artifacts,
        config_path=str(config_path) if config_path is not None else None,
        transcript_override=transcript_override,
    )
    state = build_initial_state(audio_path=audio, scenario=scenario)

    for warning in resolved_artifacts.warnings:
        state.add_warning(warning)

    try:
        final_state = workflow.invoke(state)
    except WorkflowExecutionError as exc:
        failed_path = write_result(exc.state, output)
        return AnalysisExecutionResult(state=exc.state, result_path=failed_path, error=str(exc))

    result_path = write_result(final_state, output)
    return AnalysisExecutionResult(state=final_state, result_path=result_path)


def discover_audio_files(audio_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in audio_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_AUDIO_EXTENSIONS
    )


def truncate_text(text: str, limit: int = 48) -> str:
    normalized = " ".join(text.split()).replace("|", "/")
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[: limit - 3]}..."


def format_output_reference(path: Path, *, repo_root: Path) -> str:
    try:
        return str(path.relative_to(repo_root))
    except ValueError:
        return str(path)


def build_samples_summary(rows: list[dict[str, str]], *, scenario: str, audio_dir: Path, manifest_path: Path) -> str:
    lines = [
        "# SpeakSure++ Demo Summary",
        "",
        f"- Scenario: `{scenario}`",
        f"- Audio dir: `{audio_dir}`",
        f"- Manifest: `{manifest_path}`",
        f"- Files exported: `{len(rows)}`",
        "",
        "| audio | lang | status | score | level | causes | transcript | output |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]

    for row in rows:
        lines.append(
            (
                "| {audio} | {language} | {status} | {overall_score} | {level} | "
                "{dominant_causes} | {transcript} | `{output}` |"
            ).format(**row)
        )

    return "\n".join(lines) + "\n"


def export_sample_analyses(
    *,
    audio_files: list[Path],
    scenario: str,
    output_dir: Path,
    config_path: Path | None,
    artifacts: ArtifactBundle,
    repo_root: Path,
) -> BatchExportResult:
    rows: list[dict[str, str]] = []
    failure_count = 0

    for audio_path in audio_files:
        execution = execute_analysis(
            audio=audio_path,
            scenario=scenario,
            output=output_dir / f"{audio_path.stem}.{scenario}.json",
            config_path=config_path,
            artifacts=artifacts,
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
