# SpeakSure++ Frontend

Vite + React + TypeScript frontend for the `services/agent` HTTP API.

## What it supports

- live run submission through `POST /api/v1/analyses`
- live SSE updates through `GET /api/v1/analyses/{analysis_id}/events`
- static replay loading through `POST /api/v1/replays/load`
- routed desktop workspace with separate `Run`, `Pipeline`, `Results`, and `Debug` pages
- page-level secondary navigation with remembered subviews
- shareable URL state for selected views, nodes, replay frames, feedback cards, segments, and debug panels

## Desktop Workspace

Top-level routes:

- `/run`
- `/pipeline`
- `/results`
- `/debug`

Secondary views are controlled with `?view=`.

Important shareable examples:

- `/run?view=setup&mode=live&scenario=presentation`
- `/pipeline?view=spotlight&node=reasoning`
- `/pipeline?view=timeline&node=feedback&frame=3`
- `/results?view=feedback&feedback=seg_001`
- `/results?view=segments&segment=seg_001`
- `/debug?view=overview&panel=result-json`

## Local Run

From the repository root, start the backend first:

```bash
just run-backend
```

Then start the frontend:

```bash
just run-frontend
```

Default frontend address:

- `http://127.0.0.1:5173`

Default backend target:

- `http://127.0.0.1:8000`

If you need a different backend target:

```bash
export VITE_API_PROXY_TARGET=http://127.0.0.1:8000
```

## Replay Mode

You can load a replay result like:

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

If your system watcher limit is high enough and you want to disable polling:

```bash
export VITE_USE_POLLING=false
```

## Production Build

```bash
cd services/agent/frontend
npm run build
```
