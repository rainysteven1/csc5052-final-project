#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log_step() {
  printf '\n[backend] %s\n' "$1"
}

cd "$ROOT_DIR/services/backend/go"

if command -v devbox >/dev/null 2>&1; then
  log_step "Running golangci-lint via devbox"
  devbox run -- bash -lc "cd '$ROOT_DIR/services/backend/go' && golangci-lint run --config=../.golangci.yaml ./..."
else
  log_step "Running golangci-lint via local toolchain"
  golangci-lint run --config=../.golangci.yaml ./...
fi

log_step "Running Go tests"
go test ./...

log_step "Building backend server"
go build ./cmd/server

log_step "Backend checks passed"
