"""Thin CLI bootstrap for the SpeakSure++ agent service."""
# ruff: noqa: E402, I001

from __future__ import annotations

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
repo_root_str = str(_REPO_ROOT)
if repo_root_str not in sys.path:
    sys.path.insert(0, repo_root_str)

from services.agent.src.app.cli_service import app


if __name__ == "__main__":
    app()
