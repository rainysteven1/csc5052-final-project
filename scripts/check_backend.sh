#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR/services/backend/go"

if command -v devbox >/dev/null 2>&1; then
  devbox run -- bash -lc "cd '$ROOT_DIR/services/backend/go' && golangci-lint run --config=../.golangci.yaml ./..."
else
  golangci-lint run --config=../.golangci.yaml ./...
fi

go test ./...
go build ./cmd/server
