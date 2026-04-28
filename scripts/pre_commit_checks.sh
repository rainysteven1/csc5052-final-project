#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mapfile -t STAGED_FILES < <(git diff --cached --name-only --diff-filter=ACMR)

if [ "${#STAGED_FILES[@]}" -eq 0 ]; then
  echo "No staged files to validate."
  exit 0
fi

filter_by_prefix() {
  local prefix="$1"
  shift
  local file
  for file in "$@"; do
    if [[ "$file" == "$prefix"* ]]; then
      printf '%s\n' "${file#"$prefix"}"
    fi
  done
}

filter_by_regex() {
  local regex="$1"
  shift
  local file
  for file in "$@"; do
    if [[ "$file" =~ $regex ]]; then
      printf '%s\n' "$file"
    fi
  done
}

run_frontend_checks() {
  mapfile -t frontend_files < <(filter_by_prefix "services/frontend/" "${STAGED_FILES[@]}")
  if [ "${#frontend_files[@]}" -eq 0 ]; then
    return
  fi

  mapfile -t eslint_files < <(filter_by_regex '^[^[:space:]].*\.(ts|tsx|js|jsx)$' "${frontend_files[@]}")
  mapfile -t prettier_files < <(filter_by_regex '^[^[:space:]].*\.(ts|tsx|js|jsx|json|css|scss|md)$' "${frontend_files[@]}")

  cd "$ROOT_DIR/services/frontend"
  if [ "${#eslint_files[@]}" -gt 0 ]; then
    corepack pnpm exec eslint --max-warnings 0 "${eslint_files[@]}"
  fi
  if [ "${#prettier_files[@]}" -gt 0 ]; then
    corepack pnpm exec prettier --check "${prettier_files[@]}"
  fi
  cd "$ROOT_DIR"
}

run_fake_backend_checks() {
  mapfile -t fake_backend_files < <(filter_by_prefix "services/fake-backend/" "${STAGED_FILES[@]}")
  if [ "${#fake_backend_files[@]}" -eq 0 ]; then
    return
  fi

  mapfile -t eslint_files < <(filter_by_regex '^[^[:space:]].*\.ts$' "${fake_backend_files[@]}")
  mapfile -t prettier_files < <(filter_by_regex '^[^[:space:]].*\.(ts|json|md)$' "${fake_backend_files[@]}")

  cd "$ROOT_DIR/services/fake-backend"
  if [ "${#eslint_files[@]}" -gt 0 ]; then
    corepack pnpm exec eslint --max-warnings 0 "${eslint_files[@]}"
  fi
  if [ "${#prettier_files[@]}" -gt 0 ]; then
    corepack pnpm exec prettier --check "${prettier_files[@]}"
  fi
  cd "$ROOT_DIR"
}

run_go_checks() {
  mapfile -t go_files < <(filter_by_prefix "services/backend/go/" "${STAGED_FILES[@]}")
  mapfile -t go_source_files < <(filter_by_regex '^[^[:space:]].*\.go$' "${go_files[@]}")
  if [ "${#go_source_files[@]}" -eq 0 ]; then
    return
  fi

  cd "$ROOT_DIR/services/backend/go"

  local gofmt_output
  gofmt_output="$(gofmt -l "${go_source_files[@]}")"
  if [ -n "$gofmt_output" ]; then
    echo "The following Go files are not formatted:"
    echo "$gofmt_output"
    echo "Run: gofmt -w <file>"
    exit 1
  fi

  local patch_file
  patch_file="$(mktemp)"
  git diff --cached -- services/backend/go >"$patch_file"
  if command -v devbox >/dev/null 2>&1; then
    devbox run -- bash -lc "cd '$ROOT_DIR/services/backend/go' && golangci-lint run --new-from-patch '$patch_file' --config=../.golangci.yaml ./..."
  else
    golangci-lint run --new-from-patch "$patch_file" --config=../.golangci.yaml ./...
  fi
  rm -f "$patch_file"

  cd "$ROOT_DIR"
}

run_python_checks() {
  mapfile -t python_files < <(filter_by_regex '^(services/agent/|scripts/command/).+\.py$' "${STAGED_FILES[@]}")
  if [ "${#python_files[@]}" -eq 0 ]; then
    return
  fi

  uv run --project services/agent ruff check "${python_files[@]}"
}

run_shell_checks() {
  mapfile -t shell_files < <(filter_by_regex '^[^[:space:]].*\.sh$' "${STAGED_FILES[@]}")
  if [ "${#shell_files[@]}" -eq 0 ]; then
    return
  fi

  bash -n "${shell_files[@]}"
}

run_frontend_checks
run_fake_backend_checks
run_go_checks
run_python_checks
run_shell_checks

echo "Staged-file checks passed."
