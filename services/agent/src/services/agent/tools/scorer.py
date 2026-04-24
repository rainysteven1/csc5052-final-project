"""Deterministic fusion logic for SpeakSure++ runtime scoring."""

from __future__ import annotations

from services.agent.src.schemas.analysis import SegmentScore
from services.agent.src.services.agent.contracts.analysis_contracts import ScorePayload
from services.agent.src.state import AnalysisState

DEFAULT_WEIGHTS = {"lexical": 0.4, "prosody": 0.3, "disfluency": 0.3}


def _extract_score(item: object) -> float:
    if hasattr(item, "score"):
        value = getattr(item, "score")
        return float(value or 0.0)
    if isinstance(item, dict):
        return float(item.get("score", 0.0) or 0.0)
    return 0.0


def _resolve_weights(state: AnalysisState) -> tuple[float, float, float, float]:
    context_weights = state.agent_outputs.context.weights or DEFAULT_WEIGHTS
    lexical_weight = float(context_weights.get("lexical", DEFAULT_WEIGHTS["lexical"]))
    prosody_weight = float(context_weights.get("prosody", DEFAULT_WEIGHTS["prosody"]))
    disfluency_weight = float(context_weights.get("disfluency", DEFAULT_WEIGHTS["disfluency"]))
    weight_sum = lexical_weight + prosody_weight + disfluency_weight or 1.0
    return lexical_weight, prosody_weight, disfluency_weight, weight_sum


def apply_segment_scores(state: AnalysisState) -> dict[str, float]:
    lexical_weight, prosody_weight, disfluency_weight, weight_sum = _resolve_weights(state)
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


def classify_level(overall_score: float) -> str:
    if overall_score >= 0.65:
        return "high"
    if overall_score >= 0.35:
        return "medium"
    if overall_score > 0:
        return "low"
    return "stable"


def detect_dominant_causes(state: AnalysisState) -> list[str]:
    dominant_causes: list[str] = []
    if any(_extract_score(item) > 0 for item in state.agent_outputs.lexical):
        dominant_causes.append("lexical_uncertainty")
    if any(_extract_score(item) > 0 for item in state.agent_outputs.prosody):
        dominant_causes.append("prosody")
    if any(_extract_score(item) > 0 for item in state.agent_outputs.disfluency):
        dominant_causes.append("disfluency")
    return dominant_causes


def build_summary(dominant_causes: list[str]) -> str:
    if dominant_causes == ["lexical_uncertainty"]:
        return "检测到明显的措辞不确定性，部分句子使用了弱承诺或模糊表达。"
    if dominant_causes == ["prosody"]:
        return "检测到明显的韵律问题，部分片段在语速、停顿或起伏上不够稳定。"
    if dominant_causes == ["disfluency"]:
        return "检测到明显的流畅度问题，部分句子存在填充词、重复或自我修正。"
    if dominant_causes:
        return "检测到多维度问题，部分片段在措辞、韵律或流畅度上都存在改进空间。"
    return "当前 lexical、prosody 和 disfluency 维度都未检测到明显问题。"


def score_state(state: AnalysisState) -> ScorePayload:
    averages = apply_segment_scores(state)
    overall_score = compute_overall_score(state)
    level = classify_level(overall_score)
    dominant_causes = detect_dominant_causes(state)
    summary = build_summary(dominant_causes)
    return {
        "overall_score": overall_score,
        "level": level,
        "dominant_causes": dominant_causes,
        "summary": summary,
        **averages,
    }
