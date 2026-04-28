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

Local tooling note:

- `git-cliff` and `golangci-lint` are provided by `devbox.json`
- repo commands prefer `devbox` and only fall back to global binaries when needed

## Local Run

Normal backend + frontend:

```bash
just run-backend
just run-frontend
```

Default local addresses:

- frontend: `http://127.0.0.1:5173`
- backend: `http://127.0.0.1:8000`

The frontend proxies `/api/*` to the backend through Vite.

Frontend mode is controlled by service-local env files:

- `services/frontend/.env` for the normal Go backend
- `services/frontend/.env.fake` for the fake showcase backend

In normal frontend mode, the Run page shows:

- audio upload
- scenario selector
- transcript override
- manual replay path input

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

## Public Demo Path

If you want a shareable demo without deploying the real model stack:

```bash
just run-fake-backend
just run-fake-frontend
```

This uses the file-driven Node demo API in `services/fake-backend`, including SSE event streaming for the live pipeline view.

In fake frontend mode, the Run page:

- hides audio upload
- hides scenario selection
- hides transcript override
- hides manual replay path input
- shows the showcase gallery in a single vertical column
- supports one-click `Open replay` and `Launch live`

For a public demo deployment, the recommended low-cost split is:

- `services/frontend` on Vercel
- `services/fake-backend` on Render

The repo already includes:

- `services/frontend/vercel.json` for Vercel SPA routing
- `.github/workflows/vercel-deploy.yml` for frontend deploys to Vercel
- `.github/workflows/render-fake-backend-deploy.yml` for fake-backend deploy triggers to Render

GitHub Deployments will show the frontend and fake-backend as separate environments.

## Key Docs

- backend/service details: `services/backend/README.md`
- agent analysis core: `services/agent/README.md`
- frontend workspace details: `services/frontend/README.md`
- fake demo deployment: `docs/FAKE_DEMO_DEPLOYMENT.md`
- fake backend hosting: `docs/FAKE_BACKEND_HOSTING_GUIDE.md`
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
