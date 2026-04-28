set dotenv-load := true
set dotenv-filename := ".env"

default:
    @just --list

init-env:
    @if [ -f .env ]; then \
        echo ".env already exists; leave it unchanged."; \
    else \
        cp .env.example .env; \
        echo "Created .env from .env.example"; \
    fi

doctor:
    python -m services.agent.src.app.doctor

doctor-live interval="2":
    python -m services.agent.src.app.doctor --watch --interval {{ interval }}

sync-dev:
    cd services/agent && UV_CACHE_DIR=../../.cache/uvtmp uv sync --group runtime --group dev --group proto

doctor-local:
    SPEAKSURE_ASR_PROVIDER=local python -m services.agent.src.app.doctor

proto-gen:
    ./services/agent/scripts/generate_proto.sh

run-agent-grpc asr_mode="local":
    SPEAKSURE_ASR_PROVIDER={{ asr_mode }} python services/agent/main.py



run-backend:
    cd services/backend/go && SPEAKSURE_ASR_PROVIDER=local go run ./cmd/server

run-frontend:
    cd services/frontend && npm run dev

analyze *args:
    python services/agent/cli.py analyze {{ args }}

analyze-samples *args:
    python services/agent/cli.py analyze-samples {{ args }}

lint:
    cd services/agent && UV_CACHE_DIR=../../.cache/uvtmp uv run ruff check cli.py main.py backend_bridge.py bootstrap.py src tests

test:
    PYTHONPATH=. python -m pytest services/agent/tests -q
