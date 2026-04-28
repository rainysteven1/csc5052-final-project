# Fake Demo Deployment

This repo now includes a public-demo path that does not require the real Go backend, Python agent runtime, ASR models, or LLM keys.

## Goal

Use:

- `services/frontend` as the public UI
- `services/fake-backend` as a file-driven demo API

This keeps the live product experience:

- live job creation
- SSE event streaming
- replay loading
- final result pages

without deploying heavy model infrastructure.

## Why this split

The real stack depends on:

- the Go HTTP backend
- the Python agent runtime
- local model/config/runtime assets
- external model providers

That is too heavy and too fragile for a coursework demo link.

The fake backend avoids that by serving:

- scenario catalog data from `services/fake-backend/data/catalog.json`
- replay/result payloads from `services/fake-backend/data/replays/*.json`

No demo timeline copy is stored inside the runtime code path.

## Recommended public-demo topology

- deploy `services/frontend` to Vercel
- deploy `services/fake-backend` to Render
- set `VITE_API_BASE_URL` on the frontend deployment to the fake backend origin

The separate Node host matters because the demo uses SSE for live progress updates.

This split is the current recommended coursework/public-demo setup because it stays cheap while avoiding the serverless friction of trying to run the SSE demo backend on Vercel Functions.

For concrete hosting notes, see:

- `docs/FAKE_BACKEND_HOSTING_GUIDE.md`

## Vercel frontend

The frontend already includes `services/frontend/vercel.json` with:

- Vite build settings
- `dist` output directory
- SPA rewrite to `index.html` for `/run`, `/pipeline`, `/results`, and `/debug`

Minimal setup:

1. import the repo into Vercel
2. set the project root to `services/frontend`
3. add `VITE_API_BASE_URL=https://your-fake-backend.onrender.com`
4. deploy

That is enough for the routed workspace to work correctly on refresh and deep links.

## Environment

Frontend:

```bash
VITE_API_BASE_URL=https://your-fake-backend.onrender.com
```

Fake backend:

- `PORT` optional, defaults to `18080`
- `FAKE_STREAM_STEP_DELAY_MS` optional, defaults to `3000`
- `FAKE_STREAM_COACHING_DELAY_MS` optional, defaults to `10000`

## Render fake-backend

Suggested deployment:

1. create a Render Web Service from this repository
2. set Root Directory to `services/fake-backend`
3. set Build Command to `pnpm install --frozen-lockfile --prod=false && pnpm run build`
4. set Start Command to `node dist/index.js`
5. optionally set `FAKE_STREAM_STEP_DELAY_MS=3000`
6. optionally set `FAKE_STREAM_COACHING_DELAY_MS=10000`
7. deploy and verify `GET /api/v1/health`

If you want GitHub-triggered deploys instead of relying only on Render auto-deploy, use:

- `.github/workflows/render-fake-backend-deploy.yml`
- repository secret: `RENDER_DEPLOY_HOOK_URL`
- optional repository variable: `RENDER_FAKE_BACKEND_URL`

## Local smoke-test flow

Start the fake backend:

```bash
just run-fake-backend
```

Start the frontend against it:

```bash
just run-frontend-fake
```

Then verify:

- `GET /api/v1/health`
- `GET /api/v1/demos`
- `POST /api/v1/replays/load`
- `POST /api/v1/analyses`
- `GET /api/v1/analyses/:analysisId/events`
- `GET /api/v1/analyses/:analysisId/result`

## Demo data editing

To change the public demo without touching server logic:

- edit `services/fake-backend/data/catalog.json` for scenario list and event timeline copy
- replace `services/fake-backend/data/replays/*.json` for output payloads
- keep demo audio metadata aligned as `.flac` in both catalog and replay payloads

That keeps the deployment story simple and presentation-safe.
