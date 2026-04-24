"""Typed contracts passed between agent nodes and tools."""

from __future__ import annotations

from typing import TypedDict


class SegmentFeatureMap(TypedDict):
    speech_rate: float
    pause_count: float
    pause_duration: float
    pitch_var: float
    energy_var: float


class ScorePayload(TypedDict):
    overall_score: float
    level: str
    dominant_causes: list[str]
    summary: str
    lexical_average: float
    prosody_average: float
    disfluency_average: float


class FeedbackSegmentPayload(TypedDict, total=False):
    segment_id: str
    severity: str
    focus_tags: list[str]
    reason: str
    rewrite: str
    practice: str
    practice_steps: list[str]


class ReasoningPayload(TypedDict, total=False):
    overall_score: float
    level: str
    dominant_causes: list[str]
    lexical_average: float
    prosody_average: float
    disfluency_average: float
    llm_summary: str
    llm_dominant_causes: list[str]
    coaching_focus: list[str]
    provider: str
    model: str
