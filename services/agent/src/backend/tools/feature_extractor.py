"""Lightweight audio feature extraction for the prosody agent."""

from __future__ import annotations

import array
import statistics
import wave
from pathlib import Path

from services.agent.src.backend.contracts.analysis_contracts import SegmentFeatureMap
from services.agent.src.schemas.analysis import SpeechSegment


def _chunk_values(values: list[float], chunk_size: int) -> list[list[float]]:
    if chunk_size <= 0:
        return [values] if values else []
    chunks = []
    for index in range(0, len(values), chunk_size):
        chunk = values[index : index + chunk_size]
        if chunk:
            chunks.append(chunk)
    return chunks


def _zero_crossing_rate(samples: list[int]) -> float:
    if len(samples) < 2:
        return 0.0
    crossings = 0
    for prev, current in zip(samples, samples[1:]):
        if (prev < 0 <= current) or (prev >= 0 > current):
            crossings += 1
    return crossings / len(samples)


def extract_segment_features(audio_path: str | Path, segment: SpeechSegment) -> SegmentFeatureMap:
    duration = max(segment.end - segment.start, 1e-6)
    speech_rate = round(segment.token_count / duration, 3) if segment.token_count else 0.0
    pause_duration = round(float(segment.pause_before or 0.0), 3)
    pause_count = 1.0 if pause_duration >= 0.4 else 0.0

    features = {
        "speech_rate": speech_rate,
        "pause_count": pause_count,
        "pause_duration": pause_duration,
        "pitch_var": 0.0,
        "energy_var": 0.0,
    }

    resolved = Path(audio_path).expanduser().resolve()
    if not resolved.exists():
        return features

    if resolved.read_bytes()[:4] != b"RIFF":
        return features

    with wave.open(str(resolved), "rb") as handle:
        sample_rate = handle.getframerate()
        sample_width = handle.getsampwidth()
        channels = handle.getnchannels()
        frames = handle.readframes(handle.getnframes())

    if sample_width != 2 or sample_rate <= 0:
        return features

    pcm = array.array("h")
    pcm.frombytes(frames)
    samples = list(pcm)
    if channels > 1:
        samples = samples[::channels]

    start_index = max(int(segment.start * sample_rate), 0)
    end_index = min(int(segment.end * sample_rate), len(samples))
    window = samples[start_index:end_index]
    if len(window) < 4:
        return features

    chunk_size = max(int(sample_rate * 0.05), 1)
    chunks = _chunk_values(window, chunk_size)
    if not chunks:
        return features

    rms_values = []
    zcr_values = []
    for chunk in chunks:
        mean_square = sum(sample * sample for sample in chunk) / len(chunk)
        rms_values.append(mean_square**0.5)
        zcr_values.append(_zero_crossing_rate(chunk))

    rms_mean = statistics.fmean(rms_values) if rms_values else 0.0
    if rms_mean > 0:
        features["energy_var"] = round(statistics.pstdev(rms_values) / rms_mean, 3)
    features["pitch_var"] = round(statistics.pstdev(zcr_values), 3) if len(zcr_values) > 1 else 0.0
    return features
