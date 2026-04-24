from __future__ import annotations

import math
import wave
from pathlib import Path

from services.agent.src.schemas.analysis import AudioMetadata, SpeechSegment
from services.agent.src.services.agent.nodes.prosody_node import analyze_prosody
from services.agent.src.services.agent.tools.feature_extractor import extract_segment_features
from services.agent.src.state import AnalysisState


def _write_tone_wav(path: Path, *, sample_rate: int = 16000, duration_seconds: float = 2.0) -> None:
    frame_count = int(sample_rate * duration_seconds)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        frames = bytearray()
        for i in range(frame_count):
            amplitude = 12000 if i < frame_count // 2 else 4000
            sample = int(amplitude * math.sin(2 * math.pi * 220 * (i / sample_rate)))
            frames.extend(int(sample).to_bytes(2, byteorder="little", signed=True))
        handle.writeframes(bytes(frames))


def test_extract_segment_features_reads_wav_metrics(tmp_path: Path) -> None:
    audio_path = tmp_path / "tone.wav"
    _write_tone_wav(audio_path)
    segment = SpeechSegment(
        segment_id="seg_001",
        start=0.0,
        end=2.0,
        text="We will start now.",
        pause_before=0.6,
        token_count=4,
    )

    features = extract_segment_features(audio_path, segment)

    assert features["speech_rate"] == 2.0
    assert features["pause_duration"] == 0.6
    assert features["energy_var"] > 0


def test_prosody_agent_scores_long_pause_and_low_speech_rate(tmp_path: Path) -> None:
    audio_path = tmp_path / "tone.wav"
    _write_tone_wav(audio_path)

    state = AnalysisState(
        scenario="presentation",
        audio=AudioMetadata(source_path=str(audio_path), normalized_path=str(audio_path)),
        transcript="We start now.",
        segments=[
            SpeechSegment(
                segment_id="seg_001",
                start=0.0,
                end=2.0,
                text="We start now.",
                pause_before=0.8,
                token_count=3,
            )
        ],
    )

    result = analyze_prosody(state)

    assert len(result.agent_outputs.prosody) == 1
    output = result.agent_outputs.prosody[0]
    assert output.score and output.score > 0
    assert output.features["speech_rate"] == 1.5
    assert "句前停顿偏长" in " ".join(output.explanations)
