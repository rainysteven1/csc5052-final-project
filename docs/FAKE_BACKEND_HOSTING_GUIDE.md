# Fake Backend Hosting Guide

This guide is for the public demo backend only:

- service root: `services/fake-backend`
- runtime: Node.js
- transport: regular HTTP + long-lived SSE

## When to use this

Use this backend when you want:

- a shareable coursework demo link
- stable fake live events without model keys
- replay and live views that still feel real

Do not use serverless functions for this demo backend if you want stable SSE behavior.

## Required behavior

Your host must support:

- a long-running Node process
- standard HTTP routes
- long-lived streaming responses for SSE

## Shared service settings

Recommended service root:

- `services/fake-backend`

Build command:

```bash
pnpm install --frozen-lockfile --prod=false && pnpm run build
```

Start command:

```bash
node dist/index.js
```

Default environment variables:

- `PORT` optional
- `FAKE_STREAM_STEP_DELAY_MS=3000` optional
- `FAKE_STREAM_COACHING_DELAY_MS=10000` optional

Health check:

- `GET /api/v1/health`

## Render example

Render is the recommended public-demo host for this repo because it handles a long-lived Node SSE service more naturally than Vercel.

Suggested setup:

1. create a new Web Service
2. connect the repository
3. set Root Directory to `services/fake-backend`
4. set Build Command to `pnpm install --frozen-lockfile --prod=false && pnpm run build`
5. set Start Command to `node dist/index.js`
6. deploy

If Render is building with production-only dependencies, TypeScript will fail with missing `@types/node`. In that case, keep `--prod=false` in the build command and do not force `NODE_ENV=production` during install.

After deploy, verify:

- `/api/v1/health`
- `/api/v1/demos`
- `/api/v1/analyses/:id/events` from a created job

Optional GitHub Actions trigger:

- add repository secret `RENDER_DEPLOY_HOOK_URL`
- optionally add repository variable `RENDER_FAKE_BACKEND_URL`
- use `.github/workflows/render-fake-backend-deploy.yml`

## Railway example

Suggested setup:

1. create a new service from the repository
2. set the service root to `services/fake-backend`
3. use `pnpm install --frozen-lockfile --prod=false && pnpm run build` as the build command if Railway does not infer it
4. use `node dist/index.js` as the start command
5. deploy

Then verify the same endpoints:

- `/api/v1/health`
- `/api/v1/demos`
- SSE events from a demo analysis run

## Frontend connection

Once the fake backend is live, point the Vercel frontend to it with:

```bash
VITE_API_BASE_URL=https://your-fake-backend.onrender.com
```

The frontend already supports:

- absolute `fetch(...)` API calls
- absolute `EventSource(...)` SSE connections
- demo preset loading from `/api/v1/demos`

## Demo authoring

To update the public demo content:

- edit `services/fake-backend/data/catalog.json`
- replace `services/fake-backend/data/replays/*.json`
- keep demo audio metadata aligned as `.flac` in both places

No runtime logic changes are needed for normal copy, scenario, or timeline updates.
