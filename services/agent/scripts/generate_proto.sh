#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SERVICE_DIR/../.." && pwd)"
PROTO_ROOT="$REPO_ROOT/services/proto"
export OUT_ROOT="$SERVICE_DIR/gen"
PYTHON_BIN="${PYTHON_BIN:-python}"

PROTO_FILES=(
  "$PROTO_ROOT/speaksure/v1/common.proto"
  "$PROTO_ROOT/speaksure/v1/asr_service.proto"
  "$PROTO_ROOT/speaksure/v1/agent_service.proto"
)

mkdir -p "$OUT_ROOT"

if ! "$PYTHON_BIN" -c "import grpc_tools.protoc" >/dev/null 2>&1; then
  echo "grpcio-tools is not installed for $PYTHON_BIN" >&2
  echo "Install it into the system Python first, then rerun ./services/agent/scripts/generate_proto.sh" >&2
  exit 1
fi

"$PYTHON_BIN" -m grpc_tools.protoc \
  -I"$PROTO_ROOT" \
  --python_out="$OUT_ROOT" \
  --grpc_python_out="$OUT_ROOT" \
  "${PROTO_FILES[@]}"

for package_dir in \
  "$OUT_ROOT" \
  "$OUT_ROOT/speaksure" \
  "$OUT_ROOT/speaksure/v1"
do
  mkdir -p "$package_dir"
  : > "$package_dir/__init__.py"
done

"$PYTHON_BIN" - <<'PY'
import os
from pathlib import Path

out_root = Path(os.environ["OUT_ROOT"]) / "speaksure" / "v1"
for path in out_root.glob("*.py"):
    text = path.read_text(encoding="utf-8")
    text = text.replace("from speaksure.v1 import ", "from . import ")
    path.write_text(text, encoding="utf-8")
PY
