"""Audio preprocessing helpers for the SpeakSure++ runtime."""

from __future__ import annotations

import wave
from pathlib import Path

from services.agent.src.config import data_root
from services.agent.src.state import AnalysisState

SUPPORTED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".aac", ".ogg"}


def _detect_audio_container(path: Path) -> str | None:
    header = path.read_bytes()[:4]
    if header.startswith(b"RIFF"):
        return "wav"
    if header.startswith(b"fLaC"):
        return "flac"
    return None


def preprocess_audio(state: AnalysisState) -> AnalysisState:
    source_path = Path(state.audio.source_path).expanduser().resolve()
    if not source_path.exists():
        raise FileNotFoundError(f"Audio file not found: {source_path}")
    if source_path.suffix.lower() not in SUPPORTED_AUDIO_EXTENSIONS:
        raise ValueError(f"Unsupported audio format: {source_path.suffix}")

    cache_dir = data_root() / "cache" / "audio"
    cache_dir.mkdir(parents=True, exist_ok=True)

    state.audio.normalized_path = str(source_path)
    detected_format = _detect_audio_container(source_path)
    state.audio.format = detected_format or source_path.suffix.lower().lstrip(".")
    state.audio.file_size_bytes = source_path.stat().st_size
    state.meta["preprocess_mode"] = "passthrough"

    if state.audio.format == "wav":
        try:
            with wave.open(str(source_path), "rb") as handle:
                sample_rate = handle.getframerate()
                channels = handle.getnchannels()
                frame_count = handle.getnframes()
            duration_seconds = frame_count / float(sample_rate) if sample_rate else 0.0
            state.audio.sample_rate = sample_rate
            state.audio.channels = channels
            state.audio.duration_seconds = round(duration_seconds, 3)
            state.audio.duration_ms = int(duration_seconds * 1000)
        except wave.Error as exc:
            state.add_warning(f"Unable to inspect wav metadata: {exc}")
    else:
        state.add_warning("Audio normalization is currently passthrough for non-wav files.")
        if source_path.suffix.lower() == ".wav" and state.audio.format != "wav":
            state.add_warning(
                "Audio file uses .wav suffix but container looks like "
                f"{state.audio.format}; detailed wav metadata skipped."
            )

    return state
