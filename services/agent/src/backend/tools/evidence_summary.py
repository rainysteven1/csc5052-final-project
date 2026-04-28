"""Structured evidence summary builder for the coaching stage."""

from __future__ import annotations

from collections import Counter

from services.agent.src.schemas.analysis import (
    EvidenceHotspot,
    EvidenceSignalCount,
    EvidenceSummary,
    SegmentEvidenceSummary,
)
from services.agent.src.state import AnalysisState

DIMENSION_ORDER = ("lexical", "prosody", "disfluency")


def _average_score(values: list[float]) -> float:
    if not values:
        return 0.0
    return round(sum(values) / len(values), 3)


def _top_counts(counter: Counter[str], *, limit: int = 5) -> list[EvidenceSignalCount]:
    return [EvidenceSignalCount(label=label, count=count) for label, count in counter.most_common(limit)]


def _build_hotspot(segment_id: str, score: float, reasons: list[str]) -> EvidenceHotspot:
    return EvidenceHotspot(segment_id=segment_id, score=round(score, 3), reasons=reasons[:4])


def build_evidence_summary(state: AnalysisState) -> EvidenceSummary:
    lexical_by_segment = {item.segment_id: item for item in state.agent_outputs.lexical}
    prosody_by_segment = {item.segment_id: item for item in state.agent_outputs.prosody}
    disfluency_by_segment = {item.segment_id: item for item in state.agent_outputs.disfluency}

    segment_summaries: list[SegmentEvidenceSummary] = []
    lexical_scores: list[float] = []
    prosody_scores: list[float] = []
    disfluency_scores: list[float] = []
    trigger_count = 0
    disfluency_issue_count = 0
    lexical_counter: Counter[str] = Counter()
    disfluency_counter: Counter[str] = Counter()
    prosody_hotspots: list[EvidenceHotspot] = []
    risk_segments: list[EvidenceHotspot] = []

    for segment in state.segments:
        lexical = lexical_by_segment.get(segment.segment_id)
        prosody = prosody_by_segment.get(segment.segment_id)
        disfluency = disfluency_by_segment.get(segment.segment_id)

        lexical_score = float(lexical.score or 0.0) if lexical else float(segment.scores.lexical or 0.0)
        prosody_score = float(prosody.score or 0.0) if prosody else float(segment.scores.prosody or 0.0)
        disfluency_score = (
            float(disfluency.score or 0.0) if disfluency else float(segment.scores.disfluency or 0.0)
        )
        lexical_scores.append(lexical_score)
        prosody_scores.append(prosody_score)
        disfluency_scores.append(disfluency_score)

        lexical_triggers = list(lexical.triggers) if lexical else []
        trigger_count += len(lexical_triggers)
        lexical_counter.update(item.strip().lower() for item in lexical_triggers if item.strip())

        disfluency_issue_labels: list[str] = []
        if disfluency:
            for issue in disfluency.issues:
                disfluency_issue_labels.append(f"{issue.type}:{issue.text}x{issue.count}")
                disfluency_counter.update([f"{issue.type}:{issue.text}".lower()])
            disfluency_issue_count += len(disfluency.issues)

        dominant_signals: list[str] = []
        if lexical_triggers:
            dominant_signals.append("lexical")
        if prosody and prosody.explanations:
            dominant_signals.append("prosody")
        if disfluency_issue_labels:
            dominant_signals.append("disfluency")

        reasons: list[str] = []
        if lexical_triggers:
            reasons.append(f"lexical triggers: {', '.join(lexical_triggers[:3])}")
        if prosody and prosody.explanations:
            reasons.append(f"prosody: {' / '.join(prosody.explanations[:2])}")
        if disfluency_issue_labels:
            reasons.append(f"disfluency: {' / '.join(disfluency_issue_labels[:2])}")

        final_risk_score = max(
            lexical_score,
            prosody_score,
            disfluency_score,
            float(segment.scores.final or 0.0),
        )
        if prosody_score > 0:
            prosody_hotspots.append(_build_hotspot(segment.segment_id, prosody_score, reasons or ["prosody score > 0"]))
        if final_risk_score > 0:
            risk_segments.append(_build_hotspot(segment.segment_id, final_risk_score, reasons or ["risk score > 0"]))

        segment_summaries.append(
            SegmentEvidenceSummary(
                segment_id=segment.segment_id,
                text=segment.text,
                token_count=segment.token_count,
                pause_before=segment.pause_before,
                scores={
                    "lexical": segment.scores.lexical,
                    "prosody": segment.scores.prosody,
                    "disfluency": segment.scores.disfluency,
                    "final": segment.scores.final,
                },
                lexical_triggers=lexical_triggers,
                prosody_explanations=list(prosody.explanations) if prosody else [],
                disfluency_issues=disfluency_issue_labels,
                highlight_count=len(segment.highlights),
                dominant_signals=dominant_signals,
            )
        )

    average_scores = {
        "lexical": _average_score(lexical_scores),
        "prosody": _average_score(prosody_scores),
        "disfluency": _average_score(disfluency_scores),
    }

    signal_overview: list[str] = []
    if trigger_count:
        signal_overview.append(f"lexical_triggers:{trigger_count}")
    if disfluency_issue_count:
        signal_overview.append(f"disfluency_issues:{disfluency_issue_count}")
    if any(score > 0 for score in prosody_scores):
        signal_overview.append("prosody_variation_detected")
    if state.agent_outputs.context.style_constraints:
        signal_overview.extend(
            f"style_constraint:{item}" for item in state.agent_outputs.context.style_constraints[:3]
        )

    dominant_dimensions = [
        dimension
        for dimension in DIMENSION_ORDER
        if average_scores[dimension] > 0 or any(dimension in item.dominant_signals for item in segment_summaries)
    ]

    return EvidenceSummary(
        scenario=state.scenario,
        segment_count=len(state.segments),
        average_scores=average_scores,
        trigger_count=trigger_count,
        disfluency_issue_count=disfluency_issue_count,
        context_weights=dict(state.agent_outputs.context.weights),
        style_constraints=list(state.agent_outputs.context.style_constraints),
        segments=segment_summaries,
        signal_overview=signal_overview,
        dominant_dimensions=dominant_dimensions,
        top_lexical_triggers=_top_counts(lexical_counter),
        top_disfluency_patterns=_top_counts(disfluency_counter),
        prosody_hotspots=sorted(prosody_hotspots, key=lambda item: item.score, reverse=True)[:3],
        risk_segments=sorted(risk_segments, key=lambda item: item.score, reverse=True)[:3],
    )
