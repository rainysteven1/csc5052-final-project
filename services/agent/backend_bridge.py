"""Streaming bridge between the Python analysis engine and the Go backend."""
# ruff: noqa: E402, I001

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
repo_root_str = str(_REPO_ROOT)
if repo_root_str not in sys.path:
    sys.path.insert(0, repo_root_str)

from services.agent.src.app.usecases.analysis import execute_analysis
from services.agent.bootstrap import bootstrap_agent_runtime


def _emit(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main() -> int:
    parser = argparse.ArgumentParser(description="Run SpeakSure++ analysis with JSONL progress output.")
    parser.add_argument("analyze", nargs="?", default="analyze")
    parser.add_argument("--audio", required=True)
    parser.add_argument("--scenario", default="interview")
    parser.add_argument("--output", required=True)
    parser.add_argument("--transcript-override", default=None)
    parser.add_argument("--config", default=None)
    parser.add_argument("--log-file", default=None)
    args = parser.parse_args()

    config_path = Path(args.config).expanduser().resolve() if args.config else None
    log_path = Path(args.log_file).expanduser().resolve() if args.log_file else None
    audio = Path(args.audio).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()

    bootstrap_agent_runtime(config_path=config_path, log_path=log_path)

    def _progress_callback(event: dict) -> None:
        _emit({"type": "progress", "event": event})

    execution = execute_analysis(
        audio=audio,
        scenario=args.scenario,
        output=output,
        config_path=config_path,
        transcript_override=args.transcript_override,
        progress_callback=_progress_callback,
    )

    payload = {
        "type": "completed" if not execution.error else "failed",
        "result_path": str(execution.result_path),
        "state": execution.state.model_dump(mode="json"),
        "error": execution.error,
    }
    _emit(payload)
    return 0 if not execution.error else 1


if __name__ == "__main__":
    raise SystemExit(main())
