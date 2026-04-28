#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE="${AGENT_CHECK_PROFILE:-full}"

log_step() {
  printf '\n[agent] %s\n' "$1"
}

cd "$ROOT_DIR/services/agent"

if [ "$PROFILE" = "ci" ]; then
  log_step "Syncing CI dependencies with uv"
  uv sync --group ci
  PYTEST_MARK_EXPR="${AGENT_PYTEST_MARK_EXPR:-not onnx and not hf_model}"
else
  log_step "Syncing full agent dependencies with uv"
  uv sync --group runtime --group dev --group proto
  PYTEST_MARK_EXPR="${AGENT_PYTEST_MARK_EXPR:-}"
fi

echo "[agent] profile=$PROFILE"
if [ -n "$PYTEST_MARK_EXPR" ]; then
  echo "[agent] pytest_mark_expr=$PYTEST_MARK_EXPR"
else
  echo "[agent] pytest_mark_expr=<all>"
fi

log_step "Running Ruff"
uv run ruff check cli.py main.py backend_bridge.py bootstrap.py src tests

if [ -n "$PYTEST_MARK_EXPR" ]; then
  log_step "Running pytest with marker filter"
  PYTHONPATH="$ROOT_DIR" uv run pytest tests -q -m "$PYTEST_MARK_EXPR"
else
  log_step "Running full pytest suite"
  PYTHONPATH="$ROOT_DIR" uv run pytest tests -q
fi

log_step "Agent checks passed"
