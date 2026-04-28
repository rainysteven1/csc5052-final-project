set dotenv-load := true
set dotenv-filename := ".env"

default:
    @just --list

root := justfile_directory()

init-env:
    @if [ -f .env ]; then \
        echo ".env already exists; leave it unchanged."; \
    else \
        cp .env.example .env; \
        echo "Created .env from .env.example"; \
    fi

doctor:
    python -m services.agent.src.app.doctor

proto-gen:
    ./services/agent/scripts/generate_proto.sh

run-agent-grpc asr_mode="local":
    SPEAKSURE_ASR_PROVIDER={{ asr_mode }} python services/agent/main.py

run-backend:
    cd services/backend/go && SPEAKSURE_ASR_PROVIDER=local go run ./cmd/server

backend-lint:
    @if command -v devbox >/dev/null 2>&1; then \
        devbox run -- bash -lc 'cd services/backend/go && golangci-lint run --config=../.golangci.yaml ./...'; \
    else \
        cd services/backend/go && golangci-lint run --config=../.golangci.yaml ./...; \
    fi

backend-check:
    ./scripts/check_backend.sh

run-fake-backend:
    cd services/fake-backend && corepack pnpm dev

run-frontend:
    cd services/frontend && corepack pnpm dev

run-fake-frontend:
    cd services/frontend && corepack pnpm dev:fake

frontend-build:
    cd services/frontend && corepack pnpm build

frontend-lint-fix:
    cd services/frontend && corepack pnpm lint:fix

frontend-format-check:
    cd services/frontend && corepack pnpm format

fake-backend-build:
    cd services/fake-backend && corepack pnpm build

fake-backend-lint-fix:
    cd services/fake-backend && corepack pnpm lint:fix

fake-backend-format-check:
    cd services/fake-backend && corepack pnpm format:check

changelog:
    @if command -v devbox >/dev/null 2>&1; then \
        devbox run -- git-cliff -o CHANGELOG.md; \
    else \
        git-cliff -o CHANGELOG.md; \
    fi

download-models *args:
    python scripts/command/main.py download-models {{ args }}

release-commit-preview:
    python scripts/command/main.py release-commit --preview

release-commit:
    python scripts/command/main.py release-commit

release version:
    just changelog
    git add {{ root }}/CHANGELOG.md
    git commit -m "chore(release): version {{ version }}" --no-verify
    git push -u origin main
    git tag -a "v{{ version }}" -m "Release version {{ version }}"
    git push origin "v{{ version }}"

lint:
    cd services/agent && UV_CACHE_DIR=../../.cache/uvtmp uv run ruff check cli.py main.py backend_bridge.py bootstrap.py src tests

test:
    PYTHONPATH=. python -m pytest services/agent/tests -q
