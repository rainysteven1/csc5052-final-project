# SpeakSure++ Demo and Submission Guide

This guide is meant for final demo prep, coursework handoff, and tag-based release checks.

## 1. Local Demo Flow

Start backend:

```bash
just run-backend
```

Start frontend:

```bash
just run-frontend
```

Open:

- `http://127.0.0.1:5173`

Recommended demo path:

1. Open `Run`
2. Show `mode=live` or `mode=replay`
3. Load the replay sample or launch a live run
4. Open `Pipeline` and show node-level progress
5. Open `Results` and show coaching output
6. Open `Debug` only at the end to explain raw payloads

## 2. Useful Demo URLs

Run page:

- `/run?view=setup&mode=live&scenario=presentation`
- `/run?view=overview&mode=replay&scenario=business`

Pipeline page:

- `/pipeline?view=overview&node=asr`
- `/pipeline?view=spotlight&node=reasoning`
- `/pipeline?view=timeline&node=feedback&frame=3`

Results page:

- `/results?view=feedback&feedback=seg_001`
- `/results?view=segments&segment=seg_001`
- `/results?view=overview&feedback=seg_001&segment=seg_001`

Debug page:

- `/debug?view=overview&panel=result-json`
- `/debug?view=overview&panel=event-payload`

## 3. Replay Demo File

Recommended replay file:

- `/tmp/speaksure-one-round/en_test_0315.presentation.json`

This is the easiest path for a stable demo because the UI can reconstruct the pipeline without requiring a fresh model run.

## 4. Release Workflow

The repository includes a GitHub Actions workflow triggered by tag push:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Important rule:

- the tag must match the version in `pyproject.toml`

Artifacts produced by the workflow:

- source zip
- frontend dist zip
- submission bundle zip
- release notes txt

## 5. Submission Bundle Contents

The release workflow prepares a submission bundle containing:

- repository root `README.md`
- `services/agent/README.md`
- `services/agent/frontend/README.md`
- this guide
- `pyproject.toml`
- frontend `package.json`
- built frontend files under `frontend-dist/`
- generated deployment notes

## 6. Final Manual Check Before Submission

Before tagging a release, confirm:

- `just run-backend` starts successfully
- `just run-frontend` starts successfully
- replay mode loads `/tmp/speaksure-one-round/en_test_0315.presentation.json`
- routed URLs work correctly
- `npm run build` succeeds inside `services/agent/frontend`
- the version in `pyproject.toml` matches the tag you plan to push

## 7. Suggested Short Demo Script

A compact demo script for presentation:

1. “This is the `Run` workspace for live and replay input.”
2. “This is the `Pipeline` workspace with shareable node and replay state in the URL.”
3. “This is the `Results` workspace for scoring, feedback, and segment review.”
4. “This is the `Debug` workspace for metadata and raw payload inspection.”
5. “A tagged release bundles the source, built frontend, and submission material together.”
