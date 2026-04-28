"""Print a compact runtime configuration summary."""

from __future__ import annotations

import argparse
import os
import socket
import time
from pathlib import Path

from rich.console import Group
from rich.live import Live
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from services.agent.src.asr.config import missing_whisper_onnx_files, resolve_asr_backend_config
from services.agent.src.config import default_config_path, repo_root
from services.agent.src.console import console
from services.agent.src.services.artifact_loader import read_speaksure_section


def _runtime_section() -> dict[str, object]:
    section = read_speaksure_section(default_config_path())
    runtime = section.get("runtime", {})
    return runtime if isinstance(runtime, dict) else {}


def _fmt(value: object) -> str:
    text = str(value).strip()
    return text or "<unset>"


def _fmt_path(value: object) -> str:
    text = _fmt(value)
    if text == "<unset>":
        return text

    suffix = ""
    raw_path = text
    if " (" in text and text.endswith(")"):
        raw_path, suffix = text.split(" (", 1)
        suffix = f" ({suffix}"

    path = Path(raw_path)
    try:
        return f"{path.resolve().relative_to(repo_root())}{suffix}"
    except Exception:
        return text


def _section_table(title: str) -> Table:
    table = Table(title=title, show_header=False, box=None, padding=(0, 2))
    table.add_column(style="cyan", no_wrap=True)
    table.add_column(style="white", overflow="fold")
    return table


def _section_panel(title: str, table: Table, *, border_style: str, subtitle: str | None = None) -> Panel:
    table.title = None
    return Panel(
        table,
        title=f"[bold]{title}[/bold]",
        title_align="left",
        subtitle=subtitle,
        subtitle_align="right",
        border_style=border_style,
        padding=(0, 1),
        expand=False,
    )


def _badge(value: str, *, kind: str = "default") -> str:
    normalized = value.strip().lower() or "unset"
    palette = {
        "stub": "yellow",
        "local": "green",
        "grpc": "blue",
        "api": "cyan",
        "onnx": "magenta",
        "env": "green",
        "config.toml": "cyan",
        "disabled": "yellow",
        "online": "green",
        "present": "green",
        "missing directory": "yellow",
        "unset": "white",
    }
    color = palette.get(normalized, "white")
    label = normalized.upper() if kind == "status" else normalized
    return f"[bold {color}]{label}[/bold {color}]"


def _status_label(level: str, label: str) -> str:
    palette = {
        "ok": "green",
        "warn": "yellow",
        "info": "cyan",
        "error": "red",
    }
    color = palette.get(level, "white")
    return f"[bold {color}][{level.upper()}][/bold {color}] {label}"


def _parse_host_port(endpoint: str) -> tuple[str, int] | None:
    raw = endpoint.strip()
    if not raw or ":" not in raw:
        return None

    host, port_text = raw.rsplit(":", 1)
    host = host.strip()
    port_text = port_text.strip()
    if not host or not port_text.isdigit():
        return None
    return host, int(port_text)


def _loopback_host(host: str) -> str:
    normalized = host.strip()
    if normalized in {"0.0.0.0", "::", "[::]", ""}:
        return "127.0.0.1"
    if normalized in {"localhost", "127.0.0.1"}:
        return normalized
    return normalized


def _probe_tcp(endpoint: str, *, timeout: float = 0.35) -> tuple[str, str]:
    parsed = _parse_host_port(endpoint)
    if parsed is None:
        return "warn", "invalid endpoint"

    host, port = parsed
    try:
        with socket.create_connection((_loopback_host(host), port), timeout=timeout):
            return "ok", "reachable"
    except OSError:
        return "warn", "closed"


def _check_onnx_python_deps() -> tuple[bool, str]:
    missing: list[str] = []
    for module_name in ("onnxruntime", "optimum", "transformers"):
        try:
            __import__(module_name)
        except ModuleNotFoundError:
            missing.append(module_name)

    if missing:
        return False, ", ".join(missing)
    return True, "installed"


def _check_onnx_dir(raw_path: str) -> tuple[str, str, list[str]]:
    if not raw_path.strip():
        return "<unset>", "unset", []

    path, missing = missing_whisper_onnx_files(raw_path)
    if not path.exists():
        return str(path), "missing directory", missing
    return str(path), "present", missing


def _suggest_onnx_download(raw_path: str) -> str | None:
    normalized = raw_path.strip()
    if not normalized:
        return None

    if "whisper-large-v3-turbo" in normalized:
        return (
            "huggingface-cli download onnx-community/whisper-large-v3-turbo "
            f"--local-dir {normalized} "
            '--include "config.json" '
            '--include "generation_config.json" '
            '--include "preprocessor_config.json" '
            '--include "tokenizer.json" '
            '--include "tokenizer_config.json" '
            '--include "merges.txt" '
            '--include "vocab.json" '
            '--include "normalizer.json" '
            '--include "added_tokens.json" '
            '--include "special_tokens_map.json" '
            '--include "onnx/encoder_model_int8.onnx" '
            '--include "onnx/decoder_model_merged_int8.onnx"'
        )

    if "whisper-large-v3-ONNX" in normalized:
        return (
            "huggingface-cli download onnx-community/whisper-large-v3-ONNX "
            f"--local-dir {normalized} "
            '--include "config.json" '
            '--include "generation_config.json" '
            '--include "preprocessor_config.json" '
            '--include "tokenizer.json" '
            '--include "tokenizer_config.json" '
            '--include "merges.txt" '
            '--include "vocab.json" '
            '--include "normalizer.json" '
            '--include "added_tokens.json" '
            '--include "special_tokens_map.json" '
            '--include "onnx/encoder_model_int8.onnx" '
            '--include "onnx/decoder_model_merged_int8.onnx"'
        )

    return None


def _next_actions_panel(actions: list[str]) -> Panel:
    if not actions:
        body = Text.from_markup("[green][OK][/green] No action needed. Current runtime config looks usable.")
    else:
        lines = [Text.from_markup("[bold]Recommended next actions[/bold]")]
        for index, action in enumerate(actions, start=1):
            lines.append(Text.from_markup(f"{index}. {action}"))
        body = Group(*lines)

    return Panel(
        body,
        title="[bold]Next Actions[/bold]",
        title_align="left",
        border_style="green",
        padding=(0, 1),
        expand=False,
    )


def _dedupe_actions(actions: list[str]) -> list[str]:
    return list(dict.fromkeys(actions))


def _runtime_summary_status(
    *,
    provider: str,
    backend_name: str,
    agent_grpc_probe_level: str,
    asr_target_probe_level: str,
    backend_target_probe_level: str,
    onnx_deps_ready: bool,
    missing_onnx_files: list[str],
) -> tuple[str, str, str]:
    active_probes = [agent_grpc_probe_level]
    if provider == "grpc":
        active_probes.append(asr_target_probe_level)

    active_count = sum(1 for level in active_probes if level == "ok")
    if active_count == 0:
        return "warn", "IDLE", "No transport is serving traffic yet."

    if provider == "stub":
        return "warn", "PARTIAL", "Agent is up, but ASR is still using stub mode."

    if provider == "grpc" and asr_target_probe_level != "ok":
        return "warn", "PARTIAL", "Agent expects remote ASR, but the upstream target is unreachable."

    if backend_name == "grpc" and backend_target_probe_level != "ok":
        return "warn", "PARTIAL", "ASR relay mode is enabled, but the upstream backend is unreachable."

    if backend_name == "onnx" and (not onnx_deps_ready or missing_onnx_files):
        return "warn", "PARTIAL", "ONNX backend is selected, but runtime deps or model files are incomplete."

    if agent_grpc_probe_level == "ok":
        return "ok", "READY", "Core transports respond and the configured ASR path looks usable."

    return "warn", "PARTIAL", "Configuration looks valid, but no primary entrypoint is reachable yet."


def _summary_panel(
    *,
    checked_at: str,
    status_level: str,
    status_text: str,
    status_note: str,
    provider: str,
    provider_source: str,
    backend_name: str,
    agent_grpc_probe_level: str,
    agent_grpc_probe_text: str,
) -> Panel:
    summary = _section_table("Runtime Summary")
    summary.add_row("overall", f"{_status_label(status_level, status_text)} {status_note}")
    summary.add_row("checked at", checked_at)
    summary.add_row(
        "service mesh",
        "agent grpc " f"{_status_label(agent_grpc_probe_level, agent_grpc_probe_text)}",
    )
    summary.add_row(
        "routing",
        f"{_badge(provider, kind='status')} via {_badge(provider_source)} -> {_badge(backend_name, kind='status')}",
    )
    return _section_panel(
        "Runtime Summary",
        summary,
        border_style="green" if status_level == "ok" else "yellow",
        subtitle=f"snapshot {checked_at}",
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Inspect SpeakSure runtime config and local service health.")
    parser.add_argument(
        "--watch",
        action="store_true",
        help="Refresh continuously like a small runtime dashboard.",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=2.0,
        help="Refresh interval in seconds when --watch is enabled.",
    )
    return parser.parse_args()


def _build_report() -> Group:
    runtime = _runtime_section()
    provider_env = os.getenv("SPEAKSURE_ASR_PROVIDER", "").strip()
    provider = provider_env or str(runtime.get("asr_provider", "stub"))
    backend = resolve_asr_backend_config()
    provider_source = "env" if provider_env else "config.toml"
    wandb_mode = _fmt(os.getenv("WANDB_MODE", "disabled"))
    onnx_dir_display, onnx_dir_status, missing_onnx_files = _check_onnx_dir(backend.onnx_model_dir)
    onnx_download_hint = _suggest_onnx_download(backend.onnx_model_dir)
    onnx_deps_ready, onnx_deps_detail = _check_onnx_python_deps()
    agent_grpc_bind = _fmt(runtime.get("agent_grpc_bind", "127.0.0.1:50051"))
    asr_grpc_target = _fmt(runtime.get("asr_grpc_target", "127.0.0.1:50052"))
    agent_grpc_probe_level, agent_grpc_probe_text = _probe_tcp(agent_grpc_bind)
    asr_target_probe_level, asr_target_probe_text = _probe_tcp(asr_grpc_target)
    backend_target_probe_level, backend_target_probe_text = _probe_tcp(backend.grpc_target)
    checked_at = time.strftime("%Y-%m-%d %H:%M:%S")
    status_level, status_text, status_note = _runtime_summary_status(
        provider=provider,
        backend_name=backend.backend,
        agent_grpc_probe_level=agent_grpc_probe_level,
        asr_target_probe_level=asr_target_probe_level,
        backend_target_probe_level=backend_target_probe_level,
        onnx_deps_ready=onnx_deps_ready,
        missing_onnx_files=missing_onnx_files,
    )
    next_actions: list[str] = []

    panels: list[object] = [Text.from_markup("[bold cyan]SpeakSure Runtime Doctor[/bold cyan]")]
    panels.append(
        _summary_panel(
            checked_at=checked_at,
            status_level=status_level,
            status_text=status_text,
            status_note=status_note,
            provider=provider,
            provider_source=provider_source,
            backend_name=backend.backend,
            agent_grpc_probe_level=agent_grpc_probe_level,
            agent_grpc_probe_text=agent_grpc_probe_text,
        )
    )
    environment = _section_table("Environment")
    environment.add_row("config path", _fmt_path(default_config_path()))
    environment.add_row("asr provider", f"{_status_label('info', 'transport')} {_badge(_fmt(provider), kind='status')}")
    environment.add_row(
        "provider source",
        _badge(provider_source),
    )
    environment.add_row("minimax base url", _fmt(os.getenv("MINIMAX_BASE_URL", "https://api.minimaxi.chat/v1")))
    environment.add_row("llm model", _fmt(os.getenv("SPEAKSURE_LLM_MODEL", "MiniMax-M2.7")))
    environment.add_row(
        "wandb mode",
        _status_label("warn", "disabled")
        if wandb_mode == "disabled"
        else f"{_status_label('ok', 'enabled')} {_badge(wandb_mode)}",
    )
    panels.append(
        _section_panel(
            "Environment",
            environment,
            border_style="cyan",
            subtitle=f"provider {_badge(_fmt(provider), kind='status')} via {_badge(provider_source)}",
        )
    )
    agent = _section_table("Agent Service")
    agent.add_row("grpc bind", f"{_status_label('info', 'listen')} {agent_grpc_bind}")
    agent.add_row("grpc probe", f"{_status_label(agent_grpc_probe_level, agent_grpc_probe_text)}")
    if provider == "grpc":
        agent.add_row("asr target", f"{_status_label('info', 'upstream')} {asr_grpc_target}")
        agent.add_row("target probe", f"{_status_label(asr_target_probe_level, asr_target_probe_text)}")
    panels.append(
        _section_panel(
            "Agent Service",
            agent,
            border_style="blue",
            subtitle="[bold blue]gRPC engine[/bold blue]",
        )
    )
    asr = _section_table("ASR Runtime")
    asr.add_row("backend", f"{_status_label('info', 'runtime')} {_badge(_fmt(backend.backend), kind='status')}")
    if backend.backend == "grpc":
        asr.add_row("backend target", f"{_status_label('info', 'relay')} {_fmt(backend.grpc_target)}")
        asr.add_row("backend probe", f"{_status_label(backend_target_probe_level, backend_target_probe_text)}")
    asr.add_row("onnx model dir", _fmt_path(onnx_dir_display))
    if backend.backend == "onnx" or onnx_dir_status != "unset":
        level = "ok" if onnx_dir_status == "present" else "warn"
        asr.add_row("onnx dir status", f"{_status_label(level, 'path')} {_badge(onnx_dir_status)}")
    if backend.backend == "onnx":
        if onnx_deps_ready:
            asr.add_row("onnx deps", _status_label("ok", "installed"))
        else:
            asr.add_row("onnx deps", f"{_status_label('warn', 'missing')} {onnx_deps_detail}")
            asr.add_row("deps", "cd services/agent && uv sync --group runtime")
            next_actions.append("Install ONNX runtime deps with `cd services/agent && uv sync --group runtime`.")
        if missing_onnx_files:
            asr.add_row("onnx status", f"{_status_label('warn', 'missing files')} {', '.join(missing_onnx_files)}")
            if onnx_download_hint:
                asr.add_row("suggestion", "download the minimal ONNX files with")
                asr.add_row("command", onnx_download_hint)
                next_actions.append(f"Download the minimal Whisper ONNX files with `{onnx_download_hint}`.")
        else:
            asr.add_row("onnx status", _status_label("ok", "ready"))
    elif provider == "stub":
        next_actions.append(
            "Switch `SPEAKSURE_ASR_PROVIDER` to `local` or `grpc` when you want real ASR instead of stub output."
        )
    elif provider == "grpc" and asr_target_probe_level != "ok":
        next_actions.append("Check `asr_grpc_target` or start the configured upstream ASR endpoint before sending real traffic.")
    if backend.backend == "grpc" and backend_target_probe_level != "ok":
        next_actions.append(
            "Check `asr_backend_grpc_target` or start the upstream ASR backend before using relay mode."
        )
    next_actions.append("If you want frontend REST access now, start the Go backend with `just run-backend`.")
    panels.append(
        _section_panel(
            "ASR Runtime",
            asr,
            border_style="magenta",
            subtitle=f"backend {_badge(_fmt(backend.backend), kind='status')}",
        )
    )
    panels.append(_next_actions_panel(_dedupe_actions(next_actions)))
    return Group(*panels)


def main() -> None:
    args = _parse_args()
    if args.watch:
        interval = max(args.interval, 0.5)
        with Live(_build_report(), console=console, screen=False, auto_refresh=False) as live:
            while True:
                live.update(_build_report(), refresh=True)
                time.sleep(interval)

    console.print(_build_report())


if __name__ == "__main__":
    main()
