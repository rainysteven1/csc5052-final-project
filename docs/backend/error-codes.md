# Go Backend Error Codes

This document lists the product-facing error codes returned by the Go backend under `services/backend/go`.

All JSON error responses follow this shape:

```json
{
  "detail": "Human-readable explanation",
  "code": "analysis_not_found",
  "request_id": "6cb3...",
  "trace_id": "bb90..."
}
```

## Why This Exists

- Frontend UI can map stable backend codes to cleaner user-facing copy.
- Developers can search logs by `request_id` and `trace_id`.
- Demo and grading flows become easier because API failures are consistent.

## Analysis Endpoints

### `analysis_list_failed`

- HTTP status: `500`
- Route: `GET /api/v1/analyses`
- Meaning: backend could not load the saved analysis job list

### `audio_upload_required`

- HTTP status: `400`
- Route: `POST /api/v1/analyses`
- Meaning: the request did not contain an `audio` file

### `audio_open_failed`

- HTTP status: `400`
- Route: `POST /api/v1/analyses`
- Meaning: backend could not open the uploaded file stream

### `audio_read_failed`

- HTTP status: `400`
- Route: `POST /api/v1/analyses`
- Meaning: backend could not read the uploaded file bytes

### `analysis_create_failed`

- HTTP status: `500`
- Route: `POST /api/v1/analyses`
- Meaning: backend could not create or persist the new analysis job

### `analysis_lookup_failed`

- HTTP status: `500`
- Routes:
  - `GET /api/v1/analyses/:analysis_id`
  - `GET /api/v1/analyses/:analysis_id/result`
  - `GET /api/v1/analyses/:analysis_id/events`
- Meaning: backend failed while loading an existing job record

### `analysis_not_found`

- HTTP status: `404`
- Routes:
  - `GET /api/v1/analyses/:analysis_id`
  - `GET /api/v1/analyses/:analysis_id/result`
  - `GET /api/v1/analyses/:analysis_id/events`
- Meaning: no job exists for the provided analysis ID

### `analysis_not_ready`

- HTTP status: `409`
- Route: `GET /api/v1/analyses/:analysis_id/result`
- Meaning: the job exists but is still `queued` or `running`

### `analysis_result_not_found`

- HTTP status: `404`
- Route: `GET /api/v1/analyses/:analysis_id/result`
- Meaning: job finished, but the output JSON file is missing or unreadable

## Replay Endpoints

### `replay_request_invalid`

- HTTP status: `400`
- Route: `POST /api/v1/replays/load`
- Meaning: request body is malformed or missing the replay path

### `replay_not_found`

- HTTP status: `404`
- Route: `POST /api/v1/replays/load`
- Meaning: replay JSON file could not be found or opened

## Source of Truth

The current backend constants live in:

- `services/backend/go/internal/httpapi/error_codes.go`

If a new route adds an error case, define the code there first and then document it here.
