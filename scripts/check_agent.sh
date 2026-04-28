#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR/services/agent"
uv sync --group runtime --group dev --group proto
uv run ruff check cli.py main.py backend_bridge.py bootstrap.py src tests
PYTHONPATH="$ROOT_DIR" uv run pytest tests -q
