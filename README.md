# SpeakSure++

SpeakSure++ is a speech coaching system with a routed desktop-style review frontend, a Go backend, live SSE progress streaming, and replay support for saved analysis JSON files.

## Quick Start

Initialize local environment variables first:

```bash
just init-env
```

Then fill in the values you need inside `.env`, especially:

- `MINIMAX_API_KEY`
- `MINIMAX_BASE_URL`
- `SPEAKSURE_ASR_PROVIDER`

For most stable local settings, prefer editing:

- `services/agent/config/config.toml`

Typical fields you may want to check there:

- `asr_backend`
- `asr_onnx_model_dir`
- `agent_grpc_bind`

If you want to inspect current runtime readiness:

```bash
just doctor
```

## Local Run

Backend:

```bash
just run-backend
```

Frontend:

```bash
just run-frontend
```

Default local addresses:

- frontend: `http://127.0.0.1:5173`
- backend: `http://127.0.0.1:8000`

The frontend proxies `/api/*` to the backend through Vite.

Local storage ownership:

- `services/backend/data/` stores backend jobs, uploads, and result files
- `services/agent/` keeps the Python gRPC engine, prompts, rules, models, and analysis runtime assets

## Frontend Workspace

The frontend is now organized as a routed desktop workspace instead of one long single-page dashboard.

Top-level pages:

- `/run`
- `/pipeline`
- `/results`
- `/debug`

Each page also supports secondary subviews through `?view=` query parameters.

Examples:

- `/run?view=setup&mode=live&scenario=presentation`
- `/pipeline?view=timeline&node=feedback&frame=3`
- `/results?view=feedback&feedback=seg_001`
- `/debug?view=overview&panel=result-json`

This makes the UI easier to demo, easier to share, and easier to review during submission.

## Replay Example

A replay JSON can be loaded directly from:

- `/tmp/speaksure-one-round/en_test_0315.presentation.json`

This is useful for coursework demos because it avoids needing a fresh live run every time.

## Key Docs

- backend/service details: `services/backend/README.md`
- agent analysis core: `services/agent/README.md`
- frontend workspace details: `services/frontend/README.md`
- demo and submission guide: `docs/DEMO_AND_SUBMISSION_GUIDE.md`
- model selection notes: `docs/SpeakSure++_HuggingFace预训练模型选型与下载清单.md`

## Release From Tag

A GitHub release workflow is configured to trigger when you push a tag like:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Important rule:

- the tag must match the version in `services/agent/pyproject.toml`

The workflow publishes:

- source zip
- frontend dist zip
- submission bundle zip
- release notes text file

The submission bundle includes the README files, deployment notes, and built frontend assets for handoff.


Current architecture reference:

- `docs/CURRENT_ARCHITECTURE.md`
