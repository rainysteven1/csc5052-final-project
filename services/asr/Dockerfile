FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim AS builder

ARG UV_EXPORT_GROUP=asr_runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_CACHE_DIR=/tmp/uv-cache \
    SPEAKSURE_REPO_ROOT=/app \
    SPEAKSURE_AGENT_SERVICE_ROOT=/app/services/agent \
    SPEAKSURE_AGENT_DATA_ROOT=/app/services/agent/data

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock /app/

RUN uv export \
    --frozen \
    --format requirements.txt \
    --only-group ${UV_EXPORT_GROUP} \
    --no-emit-project \
    --no-editable \
    --output-file /tmp/runtime-requirements.txt \
    && python -m venv /opt/venv \
    && /opt/venv/bin/python -m pip install --upgrade pip \
    && /opt/venv/bin/pip install -r /tmp/runtime-requirements.txt

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PATH=/opt/venv/bin:$PATH \
    SPEAKSURE_REPO_ROOT=/app \
    SPEAKSURE_AGENT_SERVICE_ROOT=/app/services/agent \
    SPEAKSURE_AGENT_DATA_ROOT=/app/services/agent/data

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /tmp/runtime-requirements.txt /app/runtime-requirements.txt
COPY services /app/services

RUN mkdir -p \
    /app/services/agent/data \
    /app/services/agent/data/cache \
    /app/services/asr/models

EXPOSE 50052

CMD ["python", "services/asr/main.py"]
