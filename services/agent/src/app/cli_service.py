"""Typer CLI service for the SpeakSure++ agent runtime."""

from __future__ import annotations

import functools
from collections.abc import Callable
from pathlib import Path
from typing import Annotated

import typer
from rich.table import Table

from services.agent.bootstrap import REPO_ROOT, bootstrap_agent_runtime
from services.agent.src.app.usecases import (
    build_samples_summary,
    discover_audio_files,
    execute_analysis,
    execute_analysis_via_grpc,
    export_sample_analyses,
    export_sample_analyses_via_grpc,
    load_runtime_artifacts,
    read_transcript_override,
    resolve_agent_grpc_target,
    upload_batch_run_to_wandb,
    upload_single_run_to_wandb,
)
from services.agent.src.config import data_root
from services.agent.src.console import console

app = typer.Typer(name="speaksure-runtime", add_completion=False, pretty_exceptions_show_locals=False)
_REPO_ROOT = REPO_ROOT
_DATA_ROOT = data_root()
_SAMPLES_ROOT = (_DATA_ROOT / "samples").resolve()


@app.callback()
def main() -> None:
    """SpeakSure++ runtime command group."""


def _print_table(title: str, rows: list[tuple[str, str]]) -> None:
    table = Table(title=title, show_header=False, box=None, padding=(0, 2))
    table.add_column(style="bold cyan")
    table.add_column(style="green")
    for key, value in rows:
        table.add_row(key, value)
    console.print(table)


def _init_runtime_app(config_path: Path | None, log_path: Path | None) -> None:
    bootstrap_agent_runtime(config_path=config_path, log_path=log_path)


def with_runtime_init(func: Callable | None = None) -> Callable:
    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            _init_runtime_app(kwargs.get("config"), kwargs.get("log_file"))
            return fn(*args, **kwargs)

        return wrapper

    if func is None:
        return decorator
    return decorator(func)


@app.command()
@with_runtime_init
def analyze(
    audio: Annotated[Path, typer.Option("--audio", exists=True, dir_okay=False, readable=True)],
    scenario: Annotated[str, typer.Option("--scenario")] = "interview",
    output: Annotated[Path | None, typer.Option("--output")] = None,
    transcript_file: Annotated[Path | None, typer.Option("--transcript-file")] = None,
    upload_wandb: Annotated[bool, typer.Option("--upload-wandb/--no-upload-wandb")] = False,
    config: Annotated[Path | None, typer.Option("-c", "--config")] = None,
    log_file: Annotated[Path | None, typer.Option("--log-file")] = None,
) -> None:
    """Run the SpeakSure++ inference pipeline and emit a JSON result."""
    transcript_override = read_transcript_override(transcript_file)
    resolved_output = output or (_DATA_ROOT / "analysis_outputs" / f"{audio.stem}.{scenario}.json")
    artifacts = load_runtime_artifacts(config)
    agent_grpc_target = resolve_agent_grpc_target(artifacts=artifacts)

    console.print("[bold]SpeakSure++ Analyze[/bold]")
    _print_table(
        "",
        [
            ("Audio", str(audio.resolve())),
            ("Scenario", scenario),
            ("Output", str(resolved_output.resolve())),
            ("Transcript override", str(transcript_file.resolve()) if transcript_file is not None else "N/A"),
            ("ASR provider", artifacts.metadata.providers.get("asr", "stub")),
            ("Agent gRPC", agent_grpc_target or "disabled"),
        ],
    )

    if agent_grpc_target:
        execution = execute_analysis_via_grpc(
            grpc_target=agent_grpc_target,
            audio=audio,
            scenario=scenario,
            output=resolved_output,
            config_path=config,
            transcript_override=transcript_override,
            upload_wandb=upload_wandb,
        )
    else:
        execution = execute_analysis(
            audio=audio,
            scenario=scenario,
            output=resolved_output,
            config_path=config,
            transcript_override=transcript_override,
            artifacts=artifacts,
        )
    if execution.error:
        console.print(f"[red]{execution.error}[/red]")
        console.print(f"[yellow]Partial result written to {execution.result_path}[/yellow]")
        raise typer.Exit(1)

    console.print(f"[bold green]Analyze complete.[/bold green] Result saved to {execution.result_path}")
    if execution.state.warnings:
        console.print("[yellow]Warnings:[/yellow]")
        for warning in execution.state.warnings:
            console.print(f"  - {warning}")
    if upload_wandb and not agent_grpc_target:
        upload_single_run_to_wandb(
            state=execution.state,
            result_path=execution.result_path,
            audio=audio,
            scenario=scenario,
            config_path=config,
        )


@app.command("analyze-samples")
@with_runtime_init
def analyze_samples(
    audio_dir: Annotated[
        Path,
        typer.Option("--audio-dir", exists=True, file_okay=False, readable=True),
    ] = _SAMPLES_ROOT / "audio",
    manifest: Annotated[
        Path,
        typer.Option("--manifest", exists=True, dir_okay=False, readable=True),
    ] = _SAMPLES_ROOT / "transcriptions.csv",
    scenario: Annotated[str, typer.Option("--scenario")] = "presentation",
    output_dir: Annotated[Path, typer.Option("--output-dir")] = _DATA_ROOT / "demo_outputs",
    summary_file: Annotated[Path | None, typer.Option("--summary-file")] = _DATA_ROOT / "demo_outputs" / "summary.md",
    limit: Annotated[int | None, typer.Option("--limit", min=1)] = None,
    upload_wandb: Annotated[bool, typer.Option("--upload-wandb/--no-upload-wandb")] = False,
    config: Annotated[Path | None, typer.Option("-c", "--config")] = None,
    log_file: Annotated[Path | None, typer.Option("--log-file")] = None,
) -> None:
    """Batch-export sample analyses and generate a compact demo summary."""
    audio_files = discover_audio_files(audio_dir)
    if not audio_files:
        console.print(f"[red]No supported audio files found under {audio_dir}[/red]")
        raise typer.Exit(1)
    if limit is not None:
        audio_files = audio_files[:limit]

    output_dir.mkdir(parents=True, exist_ok=True)
    artifacts = load_runtime_artifacts(config, manifest_path=manifest)
    agent_grpc_target = resolve_agent_grpc_target(artifacts=artifacts)

    console.print("[bold]SpeakSure++ Analyze Samples[/bold]")
    _print_table(
        "",
        [
            ("Audio dir", str(audio_dir.resolve())),
            ("Manifest", str(manifest.resolve())),
            ("Scenario", scenario),
            ("Output dir", str(output_dir.resolve())),
            ("Files", str(len(audio_files))),
            ("Agent gRPC", agent_grpc_target or "disabled"),
        ],
    )

    if agent_grpc_target:
        batch_result = export_sample_analyses_via_grpc(
            grpc_target=agent_grpc_target,
            audio_files=audio_files,
            scenario=scenario,
            output_dir=output_dir,
            config_path=config,
            repo_root=_REPO_ROOT,
            upload_wandb=upload_wandb,
        )
    else:
        batch_result = export_sample_analyses(
            audio_files=audio_files,
            scenario=scenario,
            output_dir=output_dir,
            config_path=config,
            artifacts=artifacts,
            repo_root=_REPO_ROOT,
        )

    if summary_file is not None:
        summary_file.parent.mkdir(parents=True, exist_ok=True)
        summary_file.write_text(
            build_samples_summary(batch_result.rows, scenario=scenario, audio_dir=audio_dir, manifest_path=manifest),
            encoding="utf-8",
        )

    _print_table(
        "Export Summary",
        [
            ("Completed", str(len(audio_files) - batch_result.failure_count)),
            ("Failed", str(batch_result.failure_count)),
            ("Summary file", str(summary_file.resolve()) if summary_file is not None else "disabled"),
        ],
    )
    if upload_wandb and not agent_grpc_target:
        upload_batch_run_to_wandb(
            rows=batch_result.rows,
            output_dir=output_dir,
            summary_file=summary_file,
            scenario=scenario,
            config_path=config,
            failure_count=batch_result.failure_count,
        )
    if batch_result.failure_count:
        raise typer.Exit(1)
