"""Remote ASR client helpers for teammate-provided transcription services."""

from __future__ import annotations

import json
import mimetypes
import os
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Any

from services.agent.src.logger import logger

DEFAULT_TIMEOUT_SECONDS = 30.0
TRANSCRIPT_RESPONSE_KEYS = ("transcript", "text", "transcription")


class RemoteAsrError(RuntimeError):
    """Raised when the remote ASR provider cannot produce a usable transcript."""


def _get_timeout_seconds() -> float:
    raw = os.getenv("SPEAKSURE_ASR_TIMEOUT_SECONDS", str(DEFAULT_TIMEOUT_SECONDS))
    try:
        return max(float(raw), 1.0)
    except ValueError:
        return DEFAULT_TIMEOUT_SECONDS


def _build_headers() -> dict[str, str]:
    headers = {"Accept": "application/json"}
    api_key = os.getenv("SPEAKSURE_ASR_API_KEY")
    if api_key:
        header_name = os.getenv("SPEAKSURE_ASR_AUTH_HEADER", "Authorization")
        headers[header_name] = api_key
    return headers


def _encode_multipart_form(audio_path: Path, *, scenario: str, language_hint: str | None = None) -> tuple[bytes, str]:
    boundary = f"----SpeakSureBoundary{uuid.uuid4().hex}"
    line_break = b"\r\n"
    mime_type = mimetypes.guess_type(audio_path.name)[0] or "application/octet-stream"
    parts: list[bytes] = []

    def add_field(name: str, value: str) -> None:
        parts.extend(
            [
                f"--{boundary}".encode(),
                f'Content-Disposition: form-data; name="{name}"'.encode(),
                b"",
                value.encode("utf-8"),
            ]
        )

    add_field("scenario", scenario)
    if language_hint:
        add_field("language", language_hint)

    parts.extend(
        [
            f"--{boundary}".encode(),
            (
                f'Content-Disposition: form-data; name="file"; filename="{audio_path.name}"'
            ).encode(),
            f"Content-Type: {mime_type}".encode(),
            b"",
            audio_path.read_bytes(),
            f"--{boundary}--".encode(),
            b"",
        ]
    )
    body = line_break.join(parts)
    return body, boundary


def _extract_transcript(payload: dict[str, Any]) -> str | None:
    for key in TRANSCRIPT_RESPONSE_KEYS:
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def transcribe_with_remote_asr(
    audio_path: str | Path,
    *,
    api_url: str,
    scenario: str,
    language_hint: str | None = None,
) -> tuple[str, dict[str, Any]]:
    resolved_audio = Path(audio_path).expanduser().resolve()
    if not resolved_audio.exists():
        raise RemoteAsrError(f"Audio file not found for remote ASR: {resolved_audio}")
    if not api_url.strip():
        raise RemoteAsrError("Remote ASR API URL is empty.")

    body, boundary = _encode_multipart_form(resolved_audio, scenario=scenario, language_hint=language_hint)
    headers = _build_headers()
    headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"

    request = urllib.request.Request(api_url, data=body, headers=headers, method="POST")
    timeout_seconds = _get_timeout_seconds()
    logger.info(f"Calling remote ASR provider for {resolved_audio.name} via {api_url}")

    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            raw_body = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore").strip()
        raise RemoteAsrError(f"Remote ASR HTTP {exc.code}: {detail or exc.reason}") from exc
    except urllib.error.URLError as exc:
        raise RemoteAsrError(f"Remote ASR connection failed: {exc.reason}") from exc

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise RemoteAsrError("Remote ASR returned non-JSON content.") from exc

    transcript = _extract_transcript(payload)
    if not transcript:
        raise RemoteAsrError("Remote ASR response does not contain a usable transcript field.")

    metadata = {
        "provider": "api",
        "response_model": str(payload.get("model") or payload.get("provider") or ""),
        "language": str(payload.get("language") or language_hint or ""),
    }
    return transcript, metadata
