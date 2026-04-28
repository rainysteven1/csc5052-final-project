# SpeakSure++ Frontend

Vite + React + TypeScript frontend for the SpeakSure++ analysis platform.

## What It Supports

- live analysis submission through `POST /api/v1/analyses`
- live SSE updates through `GET /api/v1/analyses/{analysis_id}/events`
- replay loading through `POST /api/v1/replays/load`
- routed desktop workspace with `Run`, `Pipeline`, `Results`, and `Debug`
- fake showcase mode backed by a file-driven demo backend

## Workspace Routes

Top-level routes:

- `/run`
- `/pipeline`
- `/results`
- `/debug`

Secondary views are controlled with `?view=`.

## Env Model

This frontend uses service-local env files inside `services/frontend/`.

- `.env` = normal backend mode
- `.env.fake` = fake showcase mode

Important env keys:

- `VITE_APP_BACKEND_MODE=live|fake`
- `VITE_API_TARGET=http://host:port`
- `VITE_API_BASE_URL=https://...` for separately deployed backends
- `VITE_HOST`
- `VITE_PORT`
- `VITE_USE_POLLING`
- `VITE_POLLING_INTERVAL`

The Vite proxy reads `VITE_API_TARGET` from the active env file.

## Normal Deployment

Use this when the frontend should talk to the real Go backend.

### Default Env

`services/frontend/.env`

```env
VITE_APP_BACKEND_MODE=live
VITE_API_TARGET=http://127.0.0.1:8000
```

### Start Locally

From the repository root:

```bash
just run-backend
just run-frontend
```

### Run-Page Behavior

In normal mode, the Run page shows:

- audio upload
- scenario selector
- transcript override
- manual replay path input

Showcase gallery is hidden in this mode.

## Fake Showcase Deployment

Use this when you want a demo-friendly frontend that other people can open without the real analysis stack.

### Default Env

`services/frontend/.env.fake`

```env
VITE_APP_BACKEND_MODE=fake
VITE_API_TARGET=http://127.0.0.1:18080
```

### Start Locally

From the repository root:

```bash
just run-fake-backend
just run-fake-frontend
```

### Run-Page Behavior

In fake mode, the Run page:

- hides audio upload
- hides scenario selection
- hides transcript override
- hides manual replay path input
- shows `Showcase gallery`
- renders showcase cards in a single vertical column
- supports one-click `Open replay` and `Launch live`

## Separate Frontend Deployment

If the frontend is deployed separately from the backend, set an absolute API base URL:

```bash
export VITE_API_BASE_URL=https://your-backend.example.com
```

For Vercel deployment:

- `services/frontend/vercel.json` already includes SPA rewrites
- set `VITE_API_BASE_URL` in the project settings if the backend is hosted elsewhere

## Replay Mode

Example replay file:

- `/tmp/speaksure-one-round/en_test_0315.presentation.json`

The frontend reconstructs a reviewable runtime timeline from the saved JSON.

Replay controls include:

- play / pause
- previous / next
- jump to first / last

## Dev Watcher Stability

Vite dev mode defaults to polling to avoid low `inotify` watcher limits.

Useful overrides:

```bash
export VITE_USE_POLLING=true
export VITE_POLLING_INTERVAL=1000
```

If your machine does not need polling:

```bash
export VITE_USE_POLLING=false
```

## Build And Validation

Build:

```bash
just frontend-build
```

Checks:

```bash
cd services/frontend
corepack pnpm type-check
corepack pnpm lint
corepack pnpm format:check
```
