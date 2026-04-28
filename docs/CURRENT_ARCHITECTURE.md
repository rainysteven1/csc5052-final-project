# Current Architecture

This document is the single source of truth for the current SpeakSure++ runtime architecture.

## Runtime Topology

```text
frontend (Vite/React)
        |
        v
backend (Go/Gin)
        |
        v
agent (Python analysis engine)
        |
        v
internal ASR runtime (in-process under services/agent/src/asr)
```

## Directory Ownership

| Path | Owner | Current role |
| --- | --- | --- |
| `services/frontend/` | Frontend | Browser UI, routed workspace, SSE client, replay UX |
| `services/backend/` | Go backend | Product-facing HTTP/SSE API and backend runtime storage |
| `services/backend/go/` | Go backend | Gin server, middleware, handlers, service/store layers |
| `services/backend/data/` | Go backend | Uploaded audio, persisted jobs, exported result files |
| `services/agent/` | Python engine | Analysis runtime, prompts, rules, orchestration, gRPC engine |
| `services/agent/src/asr/` | Python engine | In-process ASR runtime and upstream ASR clients |
| `services/agent/config/` | Python engine | Runtime config, prompts, rules |
| `services/agent/gen/` | Python engine | Generated Python gRPC stubs |
| `services/proto/` | Shared | Cross-service protocol definitions |
| `docs/` | Repo-level docs | Current architecture, submission, backend error codes, historical analysis docs |

## Service Boundaries

### `services/frontend`

- browser UI
- route-based desktop workspace
- SSE consumption
- replay loading through backend HTTP API
- no direct dependency on Python internals

### `services/backend`

- product-facing HTTP API lives under `services/backend/go`
- SSE/event streaming
- replay loading
- request/trace propagation
- job orchestration shell around the Python agent
- runtime-owned storage under `services/backend/data/`

### `services/agent`

- speech analysis engine
- prompt/rule/config loading
- orchestration graph
- in-process ASR runtime
- CLI and gRPC entrypoints for engine-side usage

## Request Flow

### Live analysis

```text
browser
  -> services/frontend
  -> services/backend/go HTTP API
  -> backend service/store/event layer
  -> services/agent/backend_bridge.py
  -> services/agent gRPC-style engine execution
  -> result JSON + SSE progress
  -> frontend pages
```

### Replay analysis

```text
browser
  -> services/frontend
  -> services/backend/go replay endpoint
  -> saved JSON under services/backend/data/results or user-provided replay file
  -> reconstructed timeline in frontend
```

## Current Pipeline Shape

The runtime pipeline is exposed as four coarse-grained stages:

1. `input`
2. `evidence`
3. `coaching`
4. `finalize`

Inside those stages, the main internal substeps are:

- `prepare_input`
- `asr`
- `segment`
- `lexical`
- `prosody`
- `disfluency`
- `context`
- `deterministic_fusion`
- `llm_coaching`
- `serialize_result`

## Current Result Contract

The current structured output focuses on:

- `judgment`
- `coaching`
- `feedback`

The runtime no longer maintains the old `reasoning` result contract.

## Configuration Ownership

### Python agent config and dependency metadata

- `services/agent/pyproject.toml`
- `services/agent/config/config.toml`
- `services/agent/config/prompts/`
- `services/agent/config/rules/`

### Go backend config

- `services/backend/config/config.toml`
- `services/backend/go/internal/config/`

### Frontend config

- `services/frontend/package.json`
- Vite env vars

## Proto Generation

Python gRPC stubs are generated from:

- `services/proto/speaksure/v1/common.proto`
- `services/proto/speaksure/v1/asr_service.proto`
- `services/proto/speaksure/v1/agent_service.proto`

Use:

```bash
./services/agent/scripts/generate_proto.sh
```

Or with an explicit interpreter:

```bash
PYTHON_BIN=python3.11 ./services/agent/scripts/generate_proto.sh
```

## Documentation Policy

Historical migration plans, old implementation checklists, and superseded design drafts are intentionally kept out of the active docs set.
Keep this file, `docs/DEMO_AND_SUBMISSION_GUIDE.md`, and service READMEs aligned with the live codebase.
