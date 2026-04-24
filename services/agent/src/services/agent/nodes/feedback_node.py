"""Feedback node with optional MiniMax generation and deterministic fallback."""

from __future__ import annotations

import json
from typing import Any

from services.agent.src.logger import logger
from services.agent.src.schemas.analysis import FeedbackOutput, SegmentFeedback
from services.agent.src.services.agent.contracts.analysis_contracts import FeedbackSegmentPayload
from services.agent.src.services.agent.tools.llm_client import (
    LLMClientError,
    RuntimeLLMClient,
    resolve_runtime_llm_config,
)
from services.agent.src.services.agent.tools.text_rewrite import build_lexical_rewrite
from services.agent.src.state import AnalysisState


def _build_feedback_fallback(state: AnalysisState) -> list[FeedbackOutput]:
    lexical_by_segment = {item.segment_id: item for item in state.agent_outputs.lexical}
    prosody_by_segment = {item.segment_id: item for item in state.agent_outputs.prosody}
    disfluency_by_segment = {item.segment_id: item for item in state.agent_outputs.disfluency}
    feedback_outputs: list[FeedbackOutput] = []

    for segment in state.segments:
        lexical_result = lexical_by_segment.get(segment.segment_id)
        prosody_result = prosody_by_segment.get(segment.segment_id)
        disfluency_result = disfluency_by_segment.get(segment.segment_id)

        reasons: list[str] = []
        practice_items: list[str] = []
        focus_tags: list[str] = []
        rewrite = segment.text

        if lexical_result and lexical_result.score and lexical_result.score > 0:
            trigger_list = "、".join(lexical_result.triggers[:3]) or "弱承诺表达"
            reasons.append(f"包含 {trigger_list} 等不确定性措辞")
            rewrite = build_lexical_rewrite(rewrite, lexical_result.triggers)
            practice_items.append("去掉模糊词后重复朗读 3 次，保持句首直接进入核心观点")
            focus_tags.append("lexical")

        if prosody_result and prosody_result.score and prosody_result.score > 0:
            reasons.append("语速、停顿或语调稳定性不足")
            practice_items.append("按短句切分朗读，控制句前停顿，并保持每句语速稳定")
            focus_tags.append("prosody")

        if disfluency_result and disfluency_result.score and disfluency_result.score > 0:
            issue_types = "、".join(issue.type for issue in disfluency_result.issues[:3])
            reasons.append(f"存在 {issue_types} 等流畅度问题")
            practice_items.append("先放慢语速朗读一遍，再用无填充词版本重复 3 次")
            focus_tags.append("disfluency")

        severity_score = max(
            segment.scores.lexical or 0.0,
            segment.scores.prosody or 0.0,
            segment.scores.disfluency or 0.0,
            segment.scores.final or 0.0,
        )
        if severity_score >= 0.65:
            severity = "high"
        elif severity_score >= 0.35:
            severity = "medium"
        elif severity_score > 0:
            severity = "low"
        else:
            severity = "stable"

        if reasons:
            reason = "该句" + "，且".join(reasons) + "。"
            practice = "；".join(practice_items) + "。"
        else:
            reason = "该句在 lexical、prosody 和 disfluency 维度没有明显问题。"
            rewrite = segment.text
            practice = "保持当前直接表达方式，继续检查语速和停顿即可。"
            practice_items = ["保持当前直接表达方式", "继续检查语速和停顿即可"]

        segment.feedback = SegmentFeedback(
            severity=severity,
            focus_tags=focus_tags,
            reason=reason,
            rewrite=rewrite,
            practice=practice,
            practice_steps=practice_items,
        )
        feedback_outputs.append(
            FeedbackOutput(
                segment_id=segment.segment_id,
                severity=segment.feedback.severity,
                focus_tags=segment.feedback.focus_tags,
                problem=segment.feedback.reason,
                rewrite=segment.feedback.rewrite,
                practice=segment.feedback.practice,
                practice_steps=segment.feedback.practice_steps,
            )
        )

    return feedback_outputs


def _build_feedback_user_prompt(state: AnalysisState) -> str:
    segment_payload: list[dict[str, Any]] = []
    lexical_by_segment = {item.segment_id: item for item in state.agent_outputs.lexical}
    prosody_by_segment = {item.segment_id: item for item in state.agent_outputs.prosody}
    disfluency_by_segment = {item.segment_id: item for item in state.agent_outputs.disfluency}

    for segment in state.segments:
        segment_payload.append(
            {
                "segment_id": segment.segment_id,
                "text": segment.text,
                "scores": segment.scores.model_dump(mode="json"),
                "lexical": lexical_by_segment.get(segment.segment_id).model_dump(mode="json")
                if lexical_by_segment.get(segment.segment_id)
                else {},
                "prosody": prosody_by_segment.get(segment.segment_id).model_dump(mode="json")
                if prosody_by_segment.get(segment.segment_id)
                else {},
                "disfluency": disfluency_by_segment.get(segment.segment_id).model_dump(mode="json")
                if disfluency_by_segment.get(segment.segment_id)
                else {},
            }
        )

    payload = {
        "scenario": state.scenario,
        "style_constraints": state.agent_outputs.context.style_constraints,
        "segments": segment_payload,
    }
    return (
        "Generate per-segment speaking feedback in Chinese. Return JSON only with a top-level key `segments`.\n"
        "Each segment item must contain: segment_id, severity, focus_tags, reason, rewrite, practice, practice_steps.\n"
        "Keep rewrite concise, practical, and more direct than the original.\n\n"
        f"{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )


def _apply_llm_feedback(state: AnalysisState, fallback_outputs: list[FeedbackOutput]) -> list[FeedbackOutput]:
    llm_cfg = resolve_runtime_llm_config()
    if not llm_cfg.enabled:
        return fallback_outputs

    try:
        client = RuntimeLLMClient(llm_cfg)
        payload = client.chat_json(
            system_prompt=(
                "You are a concise public speaking coach. You must only return valid JSON "
                "and stay grounded in the given analysis evidence."
            ),
            user_prompt=_build_feedback_user_prompt(state),
        )
    except LLMClientError as exc:
        state.add_warning(f"Feedback LLM unavailable: {exc}")
        logger.warning("[Feedback] Falling back to deterministic feedback: {}", exc)
        return fallback_outputs

    generated = payload.get("segments")
    if not isinstance(generated, list):
        state.add_warning("Feedback LLM returned malformed segment payload; using deterministic feedback.")
        return fallback_outputs

    by_segment = {item.segment_id: item for item in fallback_outputs}
    llm_metadata = {"provider": client.provider, "model": client.model}
    state.meta["llm_feedback"] = llm_metadata

    for item in generated:
        if not isinstance(item, dict):
            continue
        feedback_payload = FeedbackSegmentPayload(**item)
        segment_id = str(feedback_payload.get("segment_id", "")).strip()
        if not segment_id or segment_id not in by_segment:
            continue
        fallback = by_segment[segment_id]
        merged = FeedbackOutput(
            segment_id=segment_id,
            severity=str(feedback_payload.get("severity") or fallback.severity or "low"),
            focus_tags=[
                str(tag)
                for tag in feedback_payload.get("focus_tags", fallback.focus_tags) or fallback.focus_tags
            ],
            problem=str(feedback_payload.get("reason") or fallback.problem or ""),
            rewrite=str(feedback_payload.get("rewrite") or fallback.rewrite or ""),
            practice=str(feedback_payload.get("practice") or fallback.practice or ""),
            practice_steps=[
                str(step)
                for step in (feedback_payload.get("practice_steps") or fallback.practice_steps or [])
                if str(step).strip()
            ],
        )
        by_segment[segment_id] = merged

    final_outputs = [by_segment[segment.segment_id] for segment in state.segments if segment.segment_id in by_segment]
    for segment in state.segments:
        feedback = by_segment.get(segment.segment_id)
        if feedback is None:
            continue
        segment.feedback = SegmentFeedback(
            severity=feedback.severity,
            focus_tags=feedback.focus_tags,
            reason=feedback.problem,
            rewrite=feedback.rewrite,
            practice=feedback.practice,
            practice_steps=feedback.practice_steps,
        )
    return final_outputs


def apply_feedback(state: AnalysisState) -> AnalysisState:
    fallback_outputs = _build_feedback_fallback(state)
    state.agent_outputs.feedback = _apply_llm_feedback(state, fallback_outputs)
    state.result.segment_results = [segment.model_copy(deep=True) for segment in state.segments]
    return state
