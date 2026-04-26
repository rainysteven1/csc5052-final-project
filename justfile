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
    UV_CACHE_DIR=.cache/uvtmp uv run python -m services.agent.src.app.doctor

doctor-live interval="2":
    UV_CACHE_DIR=.cache/uvtmp uv run python -m services.agent.src.app.doctor --watch --interval {{ interval }}

sync-dev:
    UV_CACHE_DIR=.cache/uvtmp uv sync --group dev --group proto --group agent_http --group asr_runtime

sync-monolith:
    UV_CACHE_DIR=.cache/uvtmp uv pip install --python `command -v python` --group monolith_overlay

doctor-monolith:
    SPEAKSURE_ASR_PROVIDER=local python -m services.agent.src.app.doctor

proto-gen:
    UV_CACHE_DIR=.cache/uvtmp uv run python services/generate_proto.py

run-asr-grpc:
    UV_CACHE_DIR=.cache/uvtmp uv run python services/asr/main.py

run-agent-grpc asr_mode="local":
    SPEAKSURE_ASR_PROVIDER={{ asr_mode }} UV_CACHE_DIR=.cache/uvtmp uv run python services/agent/main.py

run-agent-http asr_mode="local":
    SPEAKSURE_ASR_PROVIDER={{ asr_mode }} UV_CACHE_DIR=.cache/uvtmp uv run python services/agent/http_main.py

run-backend-monolith:
    SPEAKSURE_ASR_PROVIDER=local python services/agent/http_main.py

run-backend:
    SPEAKSURE_ASR_PROVIDER=local python services/agent/http_main.py

run-backend-grpc:
    @echo "Start ASR first with: just run-asr-grpc"
    SPEAKSURE_ASR_PROVIDER=grpc UV_CACHE_DIR=.cache/uvtmp uv run python services/agent/http_main.py

run-frontend:
    cd services/agent/frontend && npm run dev

analyze *args:
    UV_CACHE_DIR=.cache/uvtmp uv run python services/agent/cli.py analyze {{ args }}

analyze-samples *args:
    UV_CACHE_DIR=.cache/uvtmp uv run python services/agent/cli.py analyze-samples {{ args }}

lint:
    UV_CACHE_DIR=.cache/uvtmp uv run ruff check services/agent/cli.py services/agent/tests services/agent services/asr

test:
    UV_CACHE_DIR=.cache/uvtmp uv run pytest services/agent/tests -q
