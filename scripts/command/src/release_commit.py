from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path

import tomllib
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

ROOT_DIR = Path(__file__).resolve().parents[3]
CONSOLE = Console()

SERVICE_FILES: dict[str, Path] = {
    "agent": Path("services/agent/pyproject.toml"),
    "backend": Path("services/backend/.version"),
    "fake-backend": Path("services/fake-backend/package.json"),
    "frontend": Path("services/frontend/package.json"),
}
HEADER_RE = re.compile(
    r"^[\s>*-]*"
    r"(?P<header>"
    r"(feat|fix|refactor|docs|chore|style|perf|test|ci|build|revert)"
    r"(?:\([^)]+\))?"
    r"!?:"  # optional breaking marker
    r"\s+.+"
    r")$"
)


class ReleaseCommitError(RuntimeError):
    """Raised when the release commit command cannot continue safely."""


@dataclass(frozen=True)
class ReleaseCommitPreview:
    ready: bool
    service: str
    service_root: str
    version_file: str
    version: str
    message: str
    staged_files: list[str]


@dataclass(frozen=True)
class ParsedCommitDetails:
    source_header: str
    body: str
    footer: str


def _run_git(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(ROOT_DIR), *args],
        check=check,
        text=True,
        capture_output=True,
    )


def _read_staged_version(service: str, path: Path) -> str:
    result = _run_git("show", f":{path.as_posix()}")
    return _extract_version(service, result.stdout)


def _read_head_version(service: str, path: Path) -> str | None:
    exists = _run_git("cat-file", "-e", f"HEAD:{path.as_posix()}", check=False)
    if exists.returncode != 0:
        return None

    result = _run_git("show", f"HEAD:{path.as_posix()}")
    return _extract_version(service, result.stdout)


def _extract_version(service: str, raw: str) -> str:
    if service == "agent":
        return tomllib.loads(raw)["project"]["version"]
    if service == "backend":
        return raw.strip()
    if service in {"frontend", "fake-backend"}:
        return json.loads(raw)["version"]
    raise ReleaseCommitError(f"Unknown service: {service}")


def _collect_staged_files() -> set[str]:
    result = _run_git("diff", "--cached", "--name-only")
    return {line.strip() for line in result.stdout.splitlines() if line.strip()}


def _service_root(path: Path) -> str:
    parts = path.parts
    if len(parts) < 2:
        raise ReleaseCommitError(f"Cannot derive service root from path: {path.as_posix()}")
    return Path(parts[0], parts[1]).as_posix()


def _validate_staged_scope(service: str, version_path: Path, staged_files: set[str]) -> None:
    service_root = _service_root(version_path)
    invalid_files = sorted(
        staged
        for staged in staged_files
        if staged != version_path.as_posix() and not staged.startswith(f"{service_root}/")
    )
    if not invalid_files:
        return

    lines = [
        f"Staged files must stay within `{service_root}` for a `{service}` release commit.",
        "Unrelated staged files:",
        *[f"- {path}" for path in invalid_files],
    ]
    raise ReleaseCommitError("\n".join(lines))


def _detect_changed_service() -> tuple[str, Path, str, set[str]]:
    staged_files = _collect_staged_files()
    detected: list[tuple[str, Path, str]] = []

    for service, path in SERVICE_FILES.items():
        normalized = path.as_posix()
        if normalized not in staged_files:
            continue

        current_version = _read_staged_version(service, path)
        head_version = _read_head_version(service, path)
        if head_version is not None and head_version == current_version:
            continue

        detected.append((service, path, current_version))

    if not detected:
        raise ReleaseCommitError("No staged service version change detected.")

    if len(detected) > 1:
        lines = [
            "Warning: multiple service version files changed. Split the release commit.",
            *[f"- {service}: {path.as_posix()} -> {version}" for service, path, version in detected],
        ]
        raise ReleaseCommitError("\n".join(lines))

    service, path, version = detected[0]
    _validate_staged_scope(service, path, staged_files)
    return service, path, version, staged_files


def _build_commit_message(service: str, version: str) -> str:
    return f"chore({service}): bump version to {version}"


def _build_preview(
    service: str,
    path: Path,
    version: str,
    message: str,
    staged_files: set[str],
) -> ReleaseCommitPreview:
    return ReleaseCommitPreview(
        ready=True,
        service=service,
        service_root=_service_root(path),
        version_file=path.as_posix(),
        version=version,
        message=message,
        staged_files=sorted(staged_files),
    )


def _preview_rich(preview: ReleaseCommitPreview) -> int:
    ordered_files = preview.staged_files

    summary = Table(show_header=False, box=None, pad_edge=False)
    summary.add_column(style="cyan", no_wrap=True)
    summary.add_column(style="white")
    summary.add_row("Ready", "[green]yes[/green]" if preview.ready else "[red]no[/red]")
    summary.add_row("Service", preview.service)
    summary.add_row("Scope", preview.service_root)
    summary.add_row("Version file", preview.version_file)
    summary.add_row("Version", preview.version)
    summary.add_row("Commit message", preview.message)
    summary.add_row("Staged files", str(len(ordered_files)))

    staged_table = Table(title="Staged Files", header_style="bold magenta")
    staged_table.add_column("#", style="dim", width=4, justify="right")
    staged_table.add_column("Path", style="white")
    for index, staged in enumerate(ordered_files, start=1):
        staged_table.add_row(str(index), staged)

    CONSOLE.print(Panel(summary, title="Release Commit Preview", border_style="green"))
    CONSOLE.print(staged_table)
    return 0


def _preview_plain(preview: ReleaseCommitPreview) -> int:
    print(f"ready={'true' if preview.ready else 'false'}")
    print(f"service={preview.service}")
    print(f"service_root={preview.service_root}")
    print(f"version_file={preview.version_file}")
    print(f"version={preview.version}")
    print(f"message={preview.message}")
    print(f"staged_count={len(preview.staged_files)}")
    for staged in preview.staged_files:
        print(f"staged={staged}")
    return 0


def _preview_json(preview: ReleaseCommitPreview) -> int:
    print(json.dumps(asdict(preview), ensure_ascii=False, indent=2))
    return 0


def _strip_code_fences(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```") and text.endswith("```"):
        lines = text.splitlines()
        if len(lines) >= 2:
            return "\n".join(lines[1:-1]).strip()
    return text


def _normalize_commit_sections(
    header: str,
    lines: list[str],
) -> ParsedCommitDetails:
    body_lines: list[str] = []
    footer_lines: list[str] = []
    current_bucket = body_lines

    for raw_line in lines:
        stripped = raw_line.strip()
        if not stripped:
            current_bucket.append("")
            continue
        if stripped.startswith("中文说明："):
            break
        if stripped.startswith("BREAKING CHANGE:") or re.match(
            r"^(Closes|Refs) #\d+", stripped
        ):
            current_bucket = footer_lines
            footer_lines.append(stripped)
            continue

        cleaned = re.sub(r"^\s*[•*-]\s+", "- ", raw_line).strip()
        if current_bucket and raw_line.startswith("  ") and current_bucket[-1]:
            current_bucket[-1] = f"{current_bucket[-1]} {cleaned}"
        else:
            current_bucket.append(cleaned)

    return ParsedCommitDetails(
        source_header=header,
        body="\n".join(line for line in body_lines).strip(),
        footer="\n".join(line for line in footer_lines).strip(),
    )


def _parse_commit_generate_output(raw: str) -> ParsedCommitDetails:
    text = _strip_code_fences(raw)
    if not text:
        raise ReleaseCommitError("Commit message input is empty.")

    header_found = False
    source_header = ""
    body_source: list[str] = []

    for line in text.splitlines():
        stripped = line.strip()
        if not header_found:
            match = HEADER_RE.match(stripped)
            if match:
                header_found = True
                source_header = match.group("header").strip()
            continue
        body_source.append(line)

    if not header_found:
        raise ReleaseCommitError(
            "Could not find a Conventional Commit header in the provided text."
        )

    return _normalize_commit_sections(source_header, body_source)


def _generate_commit_details_with_codex() -> ParsedCommitDetails:
    prompt = "\n".join(
        [
            "$commit-generate",
            "Use the currently staged git changes in this repository.",
            "Return raw commit-message-only output in English.",
            "Do not use Markdown fences.",
            "Do not include the Chinese explanation line.",
        ]
    )
    with tempfile.NamedTemporaryFile(
        mode="w+",
        encoding="utf-8",
        suffix=".txt",
        delete=False,
    ) as output_file:
        output_path = Path(output_file.name)

    try:
        subprocess.run(
            [
                "codex",
                "exec",
                "--dangerously-bypass-approvals-and-sandbox",
                "--cd",
                str(ROOT_DIR),
                "--color",
                "never",
                "--output-last-message",
                str(output_path),
                prompt,
            ],
            check=True,
            text=True,
            capture_output=True,
        )
        raw_message = output_path.read_text(encoding="utf-8")
        return _parse_commit_generate_output(raw_message)
    except FileNotFoundError as exc:
        raise ReleaseCommitError(
            "Codex CLI is not available. Install or expose `codex` before running release-commit."
        ) from exc
    finally:
        output_path.unlink(missing_ok=True)


def _print_error(message: str, *, plain: bool, as_json: bool, title: str) -> int:
    if as_json:
        print(
            json.dumps(
                {"ready": False, "error": message, "title": title},
                ensure_ascii=False,
                indent=2,
            ),
            file=sys.stderr,
        )
        return 1
    if plain:
        print("ready=false", file=sys.stderr)
        print(f"title={title}", file=sys.stderr)
        print(f"error={message}", file=sys.stderr)
        return 1

    CONSOLE.print(Panel(message, title=title, border_style="red"))
    return 1


def _render_commit_preview(header: str, details: ParsedCommitDetails | None) -> None:
    summary = Table(show_header=False, box=None, pad_edge=False)
    summary.add_column(style="cyan", no_wrap=True)
    summary.add_column(style="white")
    summary.add_row("Header", header)
    if details and details.source_header:
        summary.add_row("Reference header", details.source_header)
    summary.add_row(
        "Body bullets",
        str(len([line for line in (details.body.splitlines() if details else []) if line.strip()])),
    )
    summary.add_row(
        "Footer lines",
        str(len([line for line in (details.footer.splitlines() if details else []) if line.strip()])),
    )
    CONSOLE.print(
        Panel(summary, title="Final Release Commit Preview", border_style="blue")
    )

    if details and details.body:
        CONSOLE.print(Panel(details.body, title="Commit Body", border_style="magenta"))
    if details and details.footer:
        CONSOLE.print(
            Panel(details.footer, title="Commit Footer", border_style="cyan")
        )


def _commit(header: str, details: ParsedCommitDetails | None) -> int:
    _render_commit_preview(header, details)
    command = ["git", "-C", str(ROOT_DIR), "commit", "-m", header]
    if details and details.body:
        command.extend(["-m", details.body])
    if details and details.footer:
        command.extend(["-m", details.footer])
    subprocess.run(command, check=True)
    summary = header
    if details and details.body:
        summary = f"{header}\n\n{details.body}"
    CONSOLE.print(Panel(summary, title="Release Commit Created", border_style="green"))
    return 0


def run_release_commit(
    *,
    preview: bool,
    plain: bool,
    as_json: bool,
) -> int:
    try:
        service, path, version, staged_files = _detect_changed_service()
        header = _build_commit_message(service, version)
        preview_payload = _build_preview(service, path, version, header, staged_files)
        if preview:
            if as_json:
                return _preview_json(preview_payload)
            if plain:
                return _preview_plain(preview_payload)
            return _preview_rich(preview_payload)

        if as_json:
            return _print_error(
                "`--json` is only supported together with `--preview`.",
                plain=False,
                as_json=True,
                title="Release Commit Blocked",
            )
        if plain:
            return _print_error(
                "`--plain` is only supported together with `--preview`.",
                plain=True,
                as_json=False,
                title="Release Commit Blocked",
            )
        parsed_details = _generate_commit_details_with_codex()
        return _commit(header, parsed_details)
    except ReleaseCommitError as exc:
        return _print_error(
            str(exc),
            plain=plain,
            as_json=as_json,
            title="Release Commit Blocked",
        )
    except subprocess.CalledProcessError as exc:
        if exc.stderr:
            detail = exc.stderr.strip()
        elif exc.stdout:
            detail = exc.stdout.strip()
        else:
            detail = str(exc)
        return _print_error(
            detail,
            plain=plain,
            as_json=as_json,
            title="Git Command Failed",
        )
