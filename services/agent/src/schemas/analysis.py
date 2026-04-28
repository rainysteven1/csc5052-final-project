"""Pydantic schemas for the SpeakSure++ runtime pipeline."""

from __future__ import annotations

from datetime import UTC, datetime

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
    interpretation: str | None = None
    rewrite_hint: str | None = None
    practice_hint: str | None = None
    provider: str | None = None
    model: str | None = None


class ProsodyOutput(BaseModel):
    segment_id: str
    score: float | None = None
    features: dict[str, float] = Field(default_factory=dict)
    explanations: list[str] = Field(default_factory=list)
    interpretation: str | None = None
    coaching_hint: str | None = None
    feedback_focus: str | None = None
    provider: str | None = None
    model: str | None = None


class DisfluencyIssue(BaseModel):
    type: str
    text: str
    count: int = 1


class DisfluencyOutput(BaseModel):
    segment_id: str
    score: float | None = None
    issues: list[DisfluencyIssue] = Field(default_factory=list)
    explanations: list[str] = Field(default_factory=list)
    interpretation: str | None = None
    practice_hint: str | None = None
    feedback_focus: str | None = None
    provider: str | None = None
    model: str | None = None


class ContextOutput(BaseModel):
    scenario: str = ""
    weights: dict[str, float] = Field(default_factory=dict)
    style_constraints: list[str] = Field(default_factory=list)


class SegmentEvidenceSummary(BaseModel):
    segment_id: str
    text: str = ""
    token_count: int = 0
    pause_before: float | None = None
    scores: dict[str, float | None] = Field(default_factory=dict)
    lexical_triggers: list[str] = Field(default_factory=list)
    prosody_explanations: list[str] = Field(default_factory=list)
    disfluency_issues: list[str] = Field(default_factory=list)
    highlight_count: int = 0
    dominant_signals: list[str] = Field(default_factory=list)


class EvidenceSignalCount(BaseModel):
    label: str
    count: int = 0


class EvidenceHotspot(BaseModel):
    segment_id: str
    score: float = 0.0
    reasons: list[str] = Field(default_factory=list)


class EvidenceSummary(BaseModel):
    version: str = "v1"
    scenario: str = ""
    segment_count: int = 0
    average_scores: dict[str, float] = Field(default_factory=dict)
    trigger_count: int = 0
    disfluency_issue_count: int = 0
    context_weights: dict[str, float] = Field(default_factory=dict)
    style_constraints: list[str] = Field(default_factory=list)
    segments: list[SegmentEvidenceSummary] = Field(default_factory=list)
    signal_overview: list[str] = Field(default_factory=list)
    dominant_dimensions: list[str] = Field(default_factory=list)
    top_lexical_triggers: list[EvidenceSignalCount] = Field(default_factory=list)
    top_disfluency_patterns: list[EvidenceSignalCount] = Field(default_factory=list)
    prosody_hotspots: list[EvidenceHotspot] = Field(default_factory=list)
    risk_segments: list[EvidenceHotspot] = Field(default_factory=list)


class FeedbackOutput(BaseModel):
    segment_id: str
    severity: str | None = None
    focus_tags: list[str] = Field(default_factory=list)
    problem: str | None = None
    rewrite: str | None = None
    practice: str | None = None
    practice_steps: list[str] = Field(default_factory=list)


class JudgmentOutput(BaseModel):
    summary: str | None = None
    dominant_causes: list[str] = Field(default_factory=list)
    coaching_focus: list[str] = Field(default_factory=list)
    risk_segments: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    overall_score: float | None = None
    level: str | None = None
    provider: str | None = None
    model: str | None = None


class CoachingOutput(BaseModel):
    summary: str | None = None
    coaching_focus: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    provider: str | None = None
    model: str | None = None


class AgentOutputs(BaseModel):
    lexical: list[LexicalOutput] = Field(default_factory=list)
    prosody: list[ProsodyOutput] = Field(default_factory=list)
    disfluency: list[DisfluencyOutput] = Field(default_factory=list)
    context: ContextOutput = Field(default_factory=ContextOutput)
    evidence_summary: EvidenceSummary = Field(default_factory=EvidenceSummary)
    judgment: JudgmentOutput = Field(default_factory=JudgmentOutput)
    coaching: CoachingOutput = Field(default_factory=CoachingOutput)
    feedback: list[FeedbackOutput] = Field(default_factory=list)


class FinalAnalysisResult(BaseModel):
    status: str = "pending"
    overall_score: float | None = None
    level: str | None = None
    dominant_causes: list[str] = Field(default_factory=list)
    summary: str | None = None
    segment_results: list[SpeechSegment] = Field(default_factory=list)
    generated_at: str = Field(default_factory=utc_now_iso)
