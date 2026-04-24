"""Run the agent gRPC server."""
# ruff: noqa: E402, I001

from __future__ import annotations

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]
repo_root_str = str(_REPO_ROOT)
if repo_root_str not in sys.path:
    sys.path.insert(0, repo_root_str)

from services.agent.src.app.service_runner import run_agent_grpc_server
from services.bootstrap import bootstrap_agent_runtime


if __name__ == "__main__":
    bootstrap_agent_runtime()
    run_agent_grpc_server()
