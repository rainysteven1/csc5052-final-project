from __future__ import annotations

import typer
from src.download_models import run_download_models
from src.release_commit import run_release_commit

app = typer.Typer(
    help="SpeakSure++ command utilities.",
    add_completion=False,
    no_args_is_help=True,
)


@app.command("download-models")
def download_models_command(
    list_available: bool = typer.Option(
        False,
        "--list",
        help="Show current model status and available options.",
    ),
    preset: str | None = typer.Option(
        None,
        "--preset",
        help="Skip the wizard and use a preset selection.",
    ),
    include_existing: bool = typer.Option(
        False,
        "--include-existing",
        help="Download even if the target directory already looks ready.",
    ),
    yes: bool = typer.Option(
        False,
        "--yes",
        help="Skip the final confirmation prompt.",
    ),
) -> None:
    try:
        raise typer.Exit(
            code=run_download_models(
                list_available=list_available,
                preset=preset,
                include_existing=include_existing,
                yes=yes,
            )
        )
    except ValueError as exc:
        raise typer.BadParameter(str(exc)) from exc


@app.command("release-commit")
def release_commit_command(
    preview: bool = typer.Option(
        False,
        "--preview",
        help="Only validate staged version changes and show the fixed release title.",
    ),
    plain: bool = typer.Option(
        False,
        "--plain",
        help="Use plain key=value output together with --preview.",
    ),
    as_json: bool = typer.Option(
        False,
        "--json",
        help="Use JSON output together with --preview.",
    ),
) -> None:
    if plain and as_json:
        raise typer.BadParameter("Use only one of `--plain` or `--json`.")
    raise typer.Exit(
        code=run_release_commit(
            preview=preview,
            plain=plain,
            as_json=as_json,
        )
    )


if __name__ == "__main__":
    app()
