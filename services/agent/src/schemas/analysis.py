"""Pydantic schemas for the SpeakSure++ runtime pipeline."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


class ArtifactMetadata(BaseModel):
    asr_model_version: str = "stub-asr-v1"
    lexical_model_version: str = "rule-v1"
    prosody_model_version: str = "rule-v1"
    disfluency_model_version: str = "rule-v1"
    config_version: str = "runtime-default"
    fallback_mode: bool = True
    providers: dict[str, str] = Field(default_factory=dict)
    paths: dict[str, str] = Field(default_factory=dict)


class AudioMetadata(BaseModel):
    source_path: str = ""
    normalized_path: str = ""
    format: str | None = None
    duration_seconds: float | None = None
    duration_ms: int | None = None
    sample_rate: int | None = None
    channels: int | None = None
    file_size_bytes: int | None = None


class SegmentScore(BaseModel):
    lexical: float | None = None
    prosody: float | None = None
    disfluency: float | None = None
    final: float | None = None


class SegmentHighlight(BaseModel):
    type: str
    text: str
    start_char: int | None = None
    end_char: int | None = None


class SegmentFeedback(BaseModel):
    severity: str | None = None
    focus_tags: list[str] = Field(default_factory=list)
    reason: str | None = None
    rewrite: str | None = None
    practice: str | None = None
    practice_steps: list[str] = Field(default_factory=list)


class SpeechSegment(BaseModel):
    segment_id: str
    start: float = 0.0
    end: float = 0.0
    text: str = ""
    pause_before: float | None = None
    token_count: int = 0
    scores: SegmentScore = Field(default_factory=SegmentScore)
    highlights: list[SegmentHighlight] = Field(default_factory=list)
    feedback: SegmentFeedback = Field(default_factory=SegmentFeedback)


class LexicalOutput(BaseModel):
    segment_id: str
    score: float | None = None
    triggers: list[str] = Field(default_factory=list)
    explanations: list[str] = Field(default_factory=list)


class ProsodyOutput(BaseModel):
    segment_id: str
    score: float | None = None
    features: dict[str, float] = Field(default_factory=dict)
    explanations: list[str] = Field(default_factory=list)


class DisfluencyIssue(BaseModel):
    type: str
    text: str
    count: int = 1


class DisfluencyOutput(BaseModel):
    segment_id: str
    score: float | None = None
    issues: list[DisfluencyIssue] = Field(default_factory=list)
    explanations: list[str] = Field(default_factory=list)


class ContextOutput(BaseModel):
    scenario: str = ""
    weights: dict[str, float] = Field(default_factory=dict)
    style_constraints: list[str] = Field(default_factory=list)


class FeedbackOutput(BaseModel):
    segment_id: str
    severity: str | None = None
    focus_tags: list[str] = Field(default_factory=list)
    problem: str | None = None
    rewrite: str | None = None
    practice: str | None = None
    practice_steps: list[str] = Field(default_factory=list)


class AgentOutputs(BaseModel):
    lexical: list[LexicalOutput] = Field(default_factory=list)
    prosody: list[ProsodyOutput] = Field(default_factory=list)
    disfluency: list[DisfluencyOutput] = Field(default_factory=list)
    context: ContextOutput = Field(default_factory=ContextOutput)
    reasoning: dict[str, Any] = Field(default_factory=dict)
    feedback: list[FeedbackOutput] = Field(default_factory=list)


class FinalAnalysisResult(BaseModel):
    status: str = "pending"
    overall_score: float | None = None
    level: str | None = None
    dominant_causes: list[str] = Field(default_factory=list)
    summary: str | None = None
    segment_results: list[SpeechSegment] = Field(default_factory=list)
    generated_at: str = Field(default_factory=utc_now_iso)
