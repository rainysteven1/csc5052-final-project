"""W&B upload use cases for single and batch analyses."""

from __future__ import annotations

from pathlib import Path

from services.agent.src.state import AnalysisState
from services.agent.src.wandb_handler import WandbHandler


def build_segment_rows(state: AnalysisState) -> list[dict[str, str | float | int]]:
    rows: list[dict[str, str | float | int]] = []
    for segment in state.result.segment_results:
        rows.append(
            {
                "segment_id": segment.segment_id,
                "text": segment.text,
                "severity": segment.feedback.severity or "n/a",
                "final_score": segment.scores.final or 0.0,
                "lexical_score": segment.scores.lexical or 0.0,
                "prosody_score": segment.scores.prosody or 0.0,
                "disfluency_score": segment.scores.disfluency or 0.0,
                "focus_tags": ",".join(segment.feedback.focus_tags),
                "reason": segment.feedback.reason or "",
            }
        )
    return rows


def upload_single_run_to_wandb(
    *,
    state: AnalysisState,
    result_path: Path,
    audio: Path,
    scenario: str,
    config_path: Path | None,
) -> None:
    handler = WandbHandler(config_path)
    run_name = f"speaksure-{scenario}-{audio.stem}"
    tags = ["speaksure", scenario, state.status, str(state.meta.get("asr_mode", "unknown"))]
    if not handler.init_run(
        run_name=run_name,
        config={
            "scenario": scenario,
            "audio": str(audio),
            "workflow_engine": state.meta.get("workflow_engine", "unknown"),
        },
        tags=tags,
    ):
        return

    handler.log_metrics(
        {
            "overall_score": state.result.overall_score or 0.0,
            "warnings_count": len(state.warnings),
            "errors_count": len(state.errors),
            "segment_count": len(state.result.segment_results),
        }
    )
    handler.log_summary(
        {
            "status": state.status,
            "scenario": scenario,
            "level": state.result.level or "n/a",
            "dominant_causes": ",".join(state.result.dominant_causes),
            "summary": state.result.summary or "",
            "audio_path": str(audio),
        }
    )
    handler.log_table_rows("segments", build_segment_rows(state))
    handler.log_artifact(
        result_path,
        name=f"{audio.stem}-{scenario}-result",
        artifact_type="analysis_result",
        metadata={"scenario": scenario, "status": state.status},
        aliases=["latest"],
    )
    handler.finish()


def upload_batch_run_to_wandb(
    *,
    rows: list[dict[str, str]],
    output_dir: Path,
    summary_file: Path | None,
    scenario: str,
    config_path: Path | None,
    failure_count: int,
) -> None:
    handler = WandbHandler(config_path)
    if not handler.init_run(
        run_name=f"speaksure-batch-{scenario}",
        config={"scenario": scenario, "output_dir": str(output_dir)},
        tags=["speaksure", "batch", scenario],
    ):
        return

    handler.log_metrics(
        {
            "exported_files": len(rows),
            "failed_files": failure_count,
        }
    )
    handler.log_table_rows("batch_summary", rows)
    if summary_file is not None and summary_file.exists():
        handler.log_artifact(
            summary_file,
            name=f"speaksure-batch-{scenario}-summary",
            artifact_type="analysis_summary",
            metadata={"scenario": scenario},
            aliases=["latest"],
        )
    handler.log_artifact(
        output_dir,
        name=f"speaksure-batch-{scenario}-json",
        artifact_type="analysis_outputs",
        metadata={"scenario": scenario, "files": len(rows)},
        aliases=["latest"],
    )
    handler.finish()
