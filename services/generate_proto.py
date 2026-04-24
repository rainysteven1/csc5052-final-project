"""Generate shared gRPC Python stubs from services/proto."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

PROTO_ROOT = Path(__file__).resolve().parent / "proto"
OUT_ROOT = Path(__file__).resolve().parent / "gen"
PROTO_FILES = [
    PROTO_ROOT / "speaksure" / "v1" / "common.proto",
    PROTO_ROOT / "speaksure" / "v1" / "asr_service.proto",
    PROTO_ROOT / "speaksure" / "v1" / "agent_service.proto",
]


def _touch_package_inits() -> None:
    for package_dir in [OUT_ROOT, OUT_ROOT / "speaksure", OUT_ROOT / "speaksure" / "v1"]:
        package_dir.mkdir(parents=True, exist_ok=True)
        init_file = package_dir / "__init__.py"
        if not init_file.exists():
            init_file.write_text("", encoding="utf-8")


def main() -> None:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable,
        "-m",
        "grpc_tools.protoc",
        f"-I{PROTO_ROOT}",
        f"--python_out={OUT_ROOT}",
        f"--grpc_python_out={OUT_ROOT}",
        *(str(path) for path in PROTO_FILES),
    ]
    subprocess.run(cmd, check=True)
    _touch_package_inits()


if __name__ == "__main__":
    main()
