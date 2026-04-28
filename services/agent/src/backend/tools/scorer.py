"""Deterministic fusion logic for SpeakSure++ runtime scoring."""

from __future__ import annotations

from pathlib import Path

from services.agent.src.backend.contracts.analysis_contracts import ScorePayload
from services.agent.src.backend.tools.rule_loader import ScoringRulesConfig, load_scoring_rules
from services.agent.src.language import normalize_runtime_language, resolve_prompt_language
from services.agent.src.schemas.analysis import SegmentScore
from services.agent.src.state import AnalysisState

CONTEXT_DIMENSION_KEYWORDS: dict[str, tuple[str, ...]] = {
    "lexical": (
        "direct",
        "clear",
        "hedg",
        "wording",
        "措辞",
        "模糊",
        "直接",
        "清晰",
        "承诺词",
        "谨慎表达",
    ),
    "prosody": (
        "pace",
        "pause",
        "rhythm",
        "prosody",
        "intonation",
        "节奏",
        "停顿",
        "语速",
        "语调",
        "起伏",
    ),
    "disfluency": (
        "filler",
        "repeat",
        "repair",
        "fluency",
        "流畅",
        "填充",
        "重复",
        "自我修正",
    ),
}


def _extract_score(item: object) -> float:
    if hasattr(item, "score"):
        value = getattr(item, "score")
        return float(value or 0.0)
    if isinstance(item, dict):
        return float(item.get("score", 0.0) or 0.0)
    return 0.0


def _to_performance_score(risk_score: float) -> float:
    return round(max(0.0, min(1.0, 1.0 - risk_score)), 3)


def _resolve_weights(state: AnalysisState, rules: ScoringRulesConfig) -> tuple[float, float, float, float, float]:
    default_weights = rules.default_weights.model_dump(mode="json")
    context_weights = state.agent_outputs.context.weights or default_weights
    lexical_weight = float(context_weights.get("lexical", default_weights["lexical"]))
    prosody_weight = float(context_weights.get("prosody", default_weights["prosody"]))
    disfluency_weight = float(context_weights.get("disfluency", default_weights["disfluency"]))
    context_weight = float(context_weights.get("context", default_weights.get("context", 0.0)))
    weight_sum = lexical_weight + prosody_weight + disfluency_weight + context_weight or 1.0
    return lexical_weight, prosody_weight, disfluency_weight, context_weight, weight_sum


def _infer_context_dimensions(style_constraints: list[str]) -> list[str]:
    dimensions: list[str] = []
    for raw_constraint in style_constraints:
        constraint = str(raw_constraint).strip().lower()
        if not constraint:
            continue
        for dimension, keywords in CONTEXT_DIMENSION_KEYWORDS.items():
            if any(keyword in constraint for keyword in keywords) and dimension not in dimensions:
                dimensions.append(dimension)
    return dimensions


def _compute_context_risk(
    lexical_score: float,
    prosody_score: float,
    disfluency_score: float,
    *,
    context_dimensions: list[str],
) -> float:
    if not context_dimensions:
        return 0.0

    component_scores = {
        "lexical": lexical_score,
        "prosody": prosody_score,
        "disfluency": disfluency_score,
    }
    selected_scores = [component_scores[dimension] for dimension in context_dimensions]
    return round(sum(selected_scores) / len(selected_scores), 3)


def apply_segment_scores(
    state: AnalysisState,
    *,
    config_path: str | Path | None = None,
) -> dict[str, float]:
    runtime_language = resolve_prompt_language(state.meta)
    rules = load_scoring_rules(config_path=config_path, language=runtime_language)
    lexical_weight, prosody_weight, disfluency_weight, context_weight, _ = _resolve_weights(state, rules)
    context_dimensions = _infer_context_dimensions(state.agent_outputs.context.style_constraints)
    effective_context_weight = context_weight if context_dimensions else 0.0
    weight_sum = lexical_weight + prosody_weight + disfluency_weight + effective_context_weight or 1.0
    lexical_scores: list[float] = []
    prosody_scores: list[float] = []
    disfluency_scores: list[float] = []
    context_scores: list[float] = []

    for segment in state.segments:
        lexical_score = segment.scores.lexical or 0.0
        prosody_score = segment.scores.prosody or 0.0
        disfluency_score = segment.scores.disfluency or 0.0
        context_score = _compute_context_risk(
            lexical_score,
            prosody_score,
            disfluency_score,
            context_dimensions=context_dimensions,
        )
        lexical_scores.append(lexical_score)
        prosody_scores.append(prosody_score)
        disfluency_scores.append(disfluency_score)
        context_scores.append(context_score)
        final_score = round(
            (
                lexical_score * lexical_weight
                + prosody_score * prosody_weight
                + disfluency_score * disfluency_weight
                + context_score * effective_context_weight
            )
            / weight_sum,
            3,
        )
        segment.scores = SegmentScore(
            lexical=lexical_score,
            prosody=prosody_score,
            disfluency=disfluency_score,
            context=context_score,
            final=final_score,
        )

    return {
        "lexical_average": round(sum(lexical_scores) / len(lexical_scores), 3) if lexical_scores else 0.0,
        "prosody_average": round(sum(prosody_scores) / len(prosody_scores), 3) if prosody_scores else 0.0,
        "disfluency_average": round(sum(disfluency_scores) / len(disfluency_scores), 3) if disfluency_scores else 0.0,
        "context_average": round(sum(context_scores) / len(context_scores), 3) if context_scores else 0.0,
    }


def compute_risk_score(state: AnalysisState) -> float:
    if not state.segments:
        return 0.0
    return round(sum(segment.scores.final or 0.0 for segment in state.segments) / len(state.segments), 3)


def classify_level(
    risk_score: float,
    rules: ScoringRulesConfig | None = None,
    *,
    config_path: str | Path | None = None,
    language: str | None = None,
) -> str:
    rules = rules or load_scoring_rules(config_path=config_path, language=language)
    thresholds = rules.level_thresholds
    if risk_score <= thresholds.low_floor:
        return "excellent"
    if risk_score < thresholds.medium:
        return "good"
    if risk_score < thresholds.high:
        return "developing"
    return "needs_work"


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
    runtime_language = resolve_prompt_language(state.meta)
    rules = load_scoring_rules(config_path=config_path, language=runtime_language)
    averages = apply_segment_scores(state, config_path=config_path)
    risk_score = compute_risk_score(state)
    overall_score = _to_performance_score(risk_score)
    level = classify_level(risk_score, rules, config_path=config_path, language=runtime_language)
    dominant_causes = detect_dominant_causes(state, rules)
    summary = build_summary(dominant_causes, rules)
    return {
        "overall_score": overall_score,
        "risk_score": risk_score,
        "level": level,
        "dominant_causes": dominant_causes,
        "summary": summary,
        **averages,
    }
