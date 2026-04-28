#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR/services/fake-backend"
corepack pnpm install --frozen-lockfile
corepack pnpm type-check
corepack pnpm lint
corepack pnpm format:check
corepack pnpm build
