"""Deterministic fusion logic for SpeakSure++ runtime scoring."""

from __future__ import annotations

from pathlib import Path

from services.agent.src.schemas.analysis import SegmentScore
from services.agent.src.backend.contracts.analysis_contracts import ScorePayload
from services.agent.src.backend.tools.rule_loader import ScoringRulesConfig, load_scoring_rules
from services.agent.src.state import AnalysisState


def _extract_score(item: object) -> float:
    if hasattr(item, "score"):
        value = getattr(item, "score")
        return float(value or 0.0)
    if isinstance(item, dict):
        return float(item.get("score", 0.0) or 0.0)
    return 0.0


def _resolve_weights(state: AnalysisState, rules: ScoringRulesConfig) -> tuple[float, float, float, float]:
    default_weights = rules.default_weights.model_dump(mode="json")
    context_weights = state.agent_outputs.context.weights or default_weights
    lexical_weight = float(context_weights.get("lexical", default_weights["lexical"]))
    prosody_weight = float(context_weights.get("prosody", default_weights["prosody"]))
    disfluency_weight = float(context_weights.get("disfluency", default_weights["disfluency"]))
    weight_sum = lexical_weight + prosody_weight + disfluency_weight or 1.0
    return lexical_weight, prosody_weight, disfluency_weight, weight_sum


def apply_segment_scores(
    state: AnalysisState,
    *,
    config_path: str | Path | None = None,
) -> dict[str, float]:
    rules = load_scoring_rules(config_path=config_path)
    lexical_weight, prosody_weight, disfluency_weight, weight_sum = _resolve_weights(state, rules)
    lexical_scores: list[float] = []
    prosody_scores: list[float] = []
    disfluency_scores: list[float] = []

    for segment in state.segments:
        lexical_score = segment.scores.lexical or 0.0
        prosody_score = segment.scores.prosody or 0.0
        disfluency_score = segment.scores.disfluency or 0.0
        lexical_scores.append(lexical_score)
        prosody_scores.append(prosody_score)
        disfluency_scores.append(disfluency_score)
        final_score = round(
            (
                lexical_score * lexical_weight
                + prosody_score * prosody_weight
                + disfluency_score * disfluency_weight
            )
            / weight_sum,
            3,
        )
        segment.scores = SegmentScore(
            lexical=lexical_score,
            prosody=prosody_score,
            disfluency=disfluency_score,
            final=final_score,
        )

    return {
        "lexical_average": round(sum(lexical_scores) / len(lexical_scores), 3) if lexical_scores else 0.0,
        "prosody_average": round(sum(prosody_scores) / len(prosody_scores), 3) if prosody_scores else 0.0,
        "disfluency_average": round(sum(disfluency_scores) / len(disfluency_scores), 3) if disfluency_scores else 0.0,
    }


def compute_overall_score(state: AnalysisState) -> float:
    if not state.segments:
        return 0.0
    return round(sum(segment.scores.final or 0.0 for segment in state.segments) / len(state.segments), 3)


def classify_level(
    overall_score: float,
    rules: ScoringRulesConfig | None = None,
) -> str:
    rules = rules or load_scoring_rules()
    thresholds = rules.level_thresholds
    if overall_score >= thresholds.high:
        return "high"
    if overall_score >= thresholds.medium:
        return "medium"
    if overall_score > thresholds.low_floor:
        return "low"
    return "stable"


def detect_dominant_causes(state: AnalysisState, rules: ScoringRulesConfig) -> list[str]:
    dominant_causes: list[str] = []
    labels = rules.dominant_causes
    if any(_extract_score(item) > 0 for item in state.agent_outputs.lexical):
        dominant_causes.append(labels.lexical)
    if any(_extract_score(item) > 0 for item in state.agent_outputs.prosody):
        dominant_causes.append(labels.prosody)
    if any(_extract_score(item) > 0 for item in state.agent_outputs.disfluency):
        dominant_causes.append(labels.disfluency)
    return dominant_causes


def build_summary(dominant_causes: list[str], rules: ScoringRulesConfig) -> str:
    labels = rules.dominant_causes
    summaries = rules.summaries
    if dominant_causes == [labels.lexical]:
        return summaries.lexical_only
    if dominant_causes == [labels.prosody]:
        return summaries.prosody_only
    if dominant_causes == [labels.disfluency]:
        return summaries.disfluency_only
    if dominant_causes:
        return summaries.mixed
    return summaries.stable


def score_state(
    state: AnalysisState,
    *,
    config_path: str | Path | None = None,
) -> ScorePayload:
    rules = load_scoring_rules(config_path=config_path)
    averages = apply_segment_scores(state, config_path=config_path)
    overall_score = compute_overall_score(state)
    level = classify_level(overall_score, rules)
    dominant_causes = detect_dominant_causes(state, rules)
    summary = build_summary(dominant_causes, rules)
    return {
        "overall_score": overall_score,
        "level": level,
        "dominant_causes": dominant_causes,
        "summary": summary,
        **averages,
    }
