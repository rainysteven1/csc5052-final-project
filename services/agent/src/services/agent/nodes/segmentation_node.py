"""Segment transcript text into analysis-ready utterances."""

from __future__ import annotations

import re

from services.agent.src.schemas.analysis import SpeechSegment
from services.agent.src.state import AnalysisState

_SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?。！？])\s+")


def _split_text(text: str) -> list[str]:
    chunks = [chunk.strip() for chunk in _SENTENCE_BOUNDARY.split(text.strip()) if chunk.strip()]
    return chunks or ([text.strip()] if text.strip() else [])


def segment_transcript(state: AnalysisState) -> AnalysisState:
    if not state.raw_asr_segments and state.transcript.strip():
        state.raw_asr_segments = [
            SpeechSegment(
                segment_id="asr_001",
                start=0.0,
                end=state.audio.duration_seconds or 0.0,
                text=state.transcript,
                token_count=len(state.transcript.split()),
            )
        ]

    segments: list[SpeechSegment] = []
    counter = 1
    for raw_segment in state.raw_asr_segments:
        sentences = _split_text(raw_segment.text)
        if not sentences:
            continue
        total_chars = max(sum(len(sentence) for sentence in sentences), 1)
        current_start = raw_segment.start
        raw_duration = max(raw_segment.end - raw_segment.start, 0.0)

        for sentence in sentences:
            share = len(sentence) / total_chars
            duration = raw_duration * share if raw_duration > 0 else 0.0
            segment_end = current_start + duration
            segments.append(
                SpeechSegment(
                    segment_id=f"seg_{counter:03d}",
                    start=round(current_start, 3),
                    end=round(segment_end, 3),
                    text=sentence,
                    pause_before=0.0 if counter == 1 else 0.2,
                    token_count=len(sentence.split()),
                )
            )
            current_start = segment_end
            counter += 1

    if not segments and state.transcript.strip():
        segments.append(
            SpeechSegment(
                segment_id="seg_001",
                start=0.0,
                end=state.audio.duration_seconds or 0.0,
                text=state.transcript.strip(),
                pause_before=0.0,
                token_count=len(state.transcript.split()),
            )
        )

    state.segments = segments
    return state
