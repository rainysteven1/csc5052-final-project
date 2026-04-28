#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log_step() {
  printf '\n[frontend] %s\n' "$1"
}

cd "$ROOT_DIR/services/frontend"

log_step "Installing dependencies with pnpm"
corepack pnpm install --frozen-lockfile

log_step "Running TypeScript type-check"
corepack pnpm type-check

log_step "Running ESLint"
corepack pnpm lint

log_step "Running Prettier format check"
corepack pnpm format:check

log_step "Building production bundle"
corepack pnpm build

log_step "Frontend checks passed"
