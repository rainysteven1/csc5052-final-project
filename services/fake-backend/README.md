# SpeakSure++ Fake Backend

File-driven Node + TypeScript demo backend for the SpeakSure++ frontend.

It mimics the real API shape without running ASR or LLM models.
All demo copy and replay content comes from files under `data/`.

## What it serves

- `POST /api/v1/analyses`
- `GET /api/v1/analyses/:analysisId/events`
- `GET /api/v1/analyses/:analysisId`
- `GET /api/v1/analyses/:analysisId/result`
- `POST /api/v1/replays/load`
- `GET /api/v1/demos`
- `GET /api/v1/health`

## Data model

- `data/catalog.json` controls available scenarios and fake timeline steps
- `data/replays/*.json` stores the final replay/result payloads
- demo audio metadata is intentionally normalized to `.flac` across catalog and replay payloads
- no fake event copy is hard-coded in the runtime

## Local run

```bash
cd services/fake-backend
pnpm install
```

Then run:

```bash
just run-fake-backend
```

Default address:

- `http://127.0.0.1:18080`

If you want file-watch mode instead of the stable single-process dev server:

```bash
cd services/fake-backend
pnpm dev:watch
```

Then start the frontend against it:

```bash
just run-frontend-fake
```

The Run page will automatically fetch `/api/v1/demos`, show preset demo cards, and allow audio-free live demo runs.

Default fake live timing:

- most stage events are delayed by about 3 seconds
- the coaching stage is delayed by about 10 seconds before completion

## Deploy with Vercel frontend

Recommended public-demo split:

- `services/frontend` on Vercel
- `services/fake-backend` on Render

Deploy the frontend separately and point it to the fake backend:

```bash
VITE_API_BASE_URL=https://your-fake-backend.onrender.com
```

The frontend now resolves both `fetch(...)` and `EventSource(...)` against that base URL.

Use a Node host that supports long-lived HTTP connections, because the live demo view depends on SSE.

On Render, use a build command that installs dev dependencies for TypeScript compilation:

```bash
pnpm install --frozen-lockfile --prod=false && pnpm run build
```

If you want a GitHub-triggered Render deploy, configure:

- repository secret `RENDER_DEPLOY_HOOK_URL`
- optional repository variable `RENDER_FAKE_BACKEND_URL`
- workflow `.github/workflows/render-fake-backend-deploy.yml`

See also:

- `docs/FAKE_DEMO_DEPLOYMENT.md`
- `docs/FAKE_BACKEND_HOSTING_GUIDE.md`
