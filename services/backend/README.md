# Backend Service

This directory owns the product-facing backend layer for SpeakSure++.

Current scope:

- the runtime analysis engine stays in `services/agent`
- the active backend implementation lives in `services/backend/go`
- backend runtime config lives in `services/backend/config/config.toml`
- backend runtime storage lives in `services/backend/data/`

Backend responsibilities:

- REST API
- SSE / event streaming
- job lifecycle management
- replay loading
- upload/output storage orchestration

Non-goals for this directory:

- lexical / prosody / disfluency analysis logic
- prompt and rule definitions
- judgment / feedback generation internals

Directory summary:

- `go/`: Gin-based backend implementation
- `config/`: backend-local runtime config
- `data/jobs/`: persisted job state
- `data/uploads/`: uploaded audio files
- `data/results/`: exported analysis JSON files

Active topology:

```text
frontend -> backend -> agent
```

Run targets:

- Go backend: `just run-backend`
- Frontend: `just run-frontend`

Storage notes:

- backend upload/job/result files now belong to `services/backend/data/`
- Python agent keeps its own model/config/output assets under `services/agent/`

Reference docs:

- Error codes: `docs/backend/error-codes.md`


Directory layout:

```text
services/backend/
├── config/                  # backend-local config
├── data/                    # runtime-owned files
│   ├── jobs/                # persisted job state
│   ├── uploads/             # uploaded audio files
│   └── results/             # exported analysis results
└── go/                      # Gin HTTP/SSE backend
    ├── cmd/server/          # entrypoint
    └── internal/
        ├── config/          # Viper config loading
        ├── httpapi/         # REST and SSE routes
        ├── service/         # job/replay/event orchestration
        ├── store/           # persistence layer
        └── middleware/      # CORS and request logging
```

Startup flow:

```text
frontend
  -> Go backend HTTP/SSE
  -> backend job/service layer
  -> Python bridge
  -> services/agent gRPC engine
  -> internal ASR + analysis pipeline
  -> JSON result + SSE progress back to frontend
```

Recommended local startup:

1. `just run-backend`
2. `just run-frontend`
3. open `http://127.0.0.1:5173`
4. submit a live run or load a replay JSON
