#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE="${AGENT_CHECK_PROFILE:-full}"

cd "$ROOT_DIR/services/agent"

if [ "$PROFILE" = "ci" ]; then
  uv sync --group ci
  PYTEST_MARK_EXPR="${AGENT_PYTEST_MARK_EXPR:-not onnx and not hf_model}"
else
  uv sync --group runtime --group dev --group proto
  PYTEST_MARK_EXPR="${AGENT_PYTEST_MARK_EXPR:-}"
fi

echo "[agent-check] profile=$PROFILE"
if [ -n "$PYTEST_MARK_EXPR" ]; then
  echo "[agent-check] pytest_mark_expr=$PYTEST_MARK_EXPR"
else
  echo "[agent-check] pytest_mark_expr=<all>"
fi

uv run ruff check cli.py main.py backend_bridge.py bootstrap.py src tests

if [ -n "$PYTEST_MARK_EXPR" ]; then
  PYTHONPATH="$ROOT_DIR" uv run pytest tests -q -m "$PYTEST_MARK_EXPR"
else
  PYTHONPATH="$ROOT_DIR" uv run pytest tests -q
fi
