"""Feedback synthesis helpers plus a legacy feedback wrapper."""

from __future__ import annotations

import json
from pathlib import Path

from services.agent.src.logger import logger
from services.agent.src.schemas.analysis import FeedbackOutput, SegmentFeedback
from services.agent.src.backend.contracts.analysis_contracts import FeedbackSegmentPayload
from services.agent.src.backend.tools import (
    LLMClientError,
    RuntimeLLMClient,
    build_lexical_rewrite,
    load_feedback_fallback_rules,
    load_prompt_template,
    prompt_debug_enabled,
    render_prompt_template,
    resolve_runtime_llm_config,
    resolve_prompt_template_path,
)
from services.agent.src.state import AnalysisState

SEVERITY_ORDER = ["stable", "low", "medium", "high"]


def _render_feedback_template(template: str, **variables: str) -> str:
    rendered = template
    for key, value in variables.items():
        rendered = rendered.replace(f"{{{key}}}", value)
    return rendered


def _infer_dimension(label: str) -> str | None:
    lowered = label.strip().lower()
    if any(token in lowered for token in ("lexical", "wording", "hedging", "direct", "措辞", "模糊", "直接")):
        return "lexical"
    if any(token in lowered for token in ("prosody", "pace", "pause", "intonation", "节奏", "停顿", "语速", "语调")):
        return "prosody"
    if any(token in lowered for token in ("disfluency", "filler", "repeat", "repair", "流畅", "填充", "重复", "自我修正")):
        return "disfluency"
    return None


def _priority_dimensions(state: AnalysisState) -> list[str]:
    judgment = state.agent_outputs.judgment
    ordered: list[str] = []
    for item in [*judgment.coaching_focus, *judgment.dominant_causes]:
        dimension = _infer_dimension(item)
        if dimension and dimension not in ordered:
            ordered.append(dimension)
    return ordered


def _reorder_focus_tags(tags: list[str], priority_dimensions: list[str]) -> list[str]:
    ordered: list[str] = []
    for dimension in priority_dimensions:
        if dimension in tags and dimension not in ordered:
            ordered.append(dimension)
    for tag in tags:
        if tag not in ordered:
            ordered.append(tag)
    return ordered


def _bump_severity(severity: str) -> str:
    try:
        index = SEVERITY_ORDER.index(severity)
    except ValueError:
        return severity
    return SEVERITY_ORDER[min(index + 1, len(SEVERITY_ORDER) - 1)]


def _build_feedback_fallback(
    state: AnalysisState,
    *,
    config_path: str | Path | None = None,
) -> list[FeedbackOutput]:
    lexical_by_segment = {item.segment_id: item for item in state.agent_outputs.lexical}
    prosody_by_segment = {item.segment_id: item for item in state.agent_outputs.prosody}
    disfluency_by_segment = {item.segment_id: item for item in state.agent_outputs.disfluency}
    rules = load_feedback_fallback_rules(config_path=config_path)
    feedback_outputs: list[FeedbackOutput] = []
    priority_dimensions = _priority_dimensions(state)
    risk_segment_ids = set(state.agent_outputs.judgment.risk_segments)

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
            reasons.append(_render_feedback_template(rules.reasons.lexical, triggers=trigger_list, issue_types=""))
            rewrite = build_lexical_rewrite(rewrite, lexical_result.triggers)
            practice_items.append(rules.practices.lexical)
            focus_tags.append(rules.focus_tags.lexical)

        if prosody_result and prosody_result.score and prosody_result.score > 0:
            reasons.append(rules.reasons.prosody)
            practice_items.append(rules.practices.prosody)
            focus_tags.append(rules.focus_tags.prosody)

        if disfluency_result and disfluency_result.score and disfluency_result.score > 0:
            issue_types = "、".join(issue.type for issue in disfluency_result.issues[:3])
            reasons.append(_render_feedback_template(rules.reasons.disfluency, triggers="", issue_types=issue_types))
            practice_items.append(rules.practices.disfluency)
            focus_tags.append(rules.focus_tags.disfluency)

        focus_tags = _reorder_focus_tags(focus_tags, priority_dimensions)

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

        if segment.segment_id in risk_segment_ids and severity != "high":
            severity = _bump_severity(severity)

        if reasons:
            reason = rules.join.prefix + rules.join.delimiter.join(reasons) + rules.join.suffix
            practice = rules.join.practice_delimiter.join(practice_items) + rules.join.suffix
        else:
            reason = rules.reasons.stable
            rewrite = segment.text
            practice = rules.practices.stable
            practice_items = list(rules.practices.stable_steps)

        if segment.segment_id in risk_segment_ids and state.agent_outputs.judgment.coaching_focus:
            practice_prefix = f"优先结合整体判断聚焦：{state.agent_outputs.judgment.coaching_focus[0]}"
            if practice:
                practice = f"{practice_prefix}{rules.join.practice_delimiter}{practice}"
            else:
                practice = practice_prefix
            if not reasons:
                reason = f"该句被整体判断识别为优先关注片段。{reason}"

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


def _build_feedback_prompt_variables(state: AnalysisState) -> dict[str, str]:
    payload = {
        "scenario": state.scenario,
        "style_constraints": state.agent_outputs.context.style_constraints,
        "judgment": state.agent_outputs.judgment.model_dump(mode="json"),
        "evidence_summary": state.agent_outputs.evidence_summary.model_dump(mode="json"),
    }
    return {
        "scenario": state.scenario,
        "style_constraints": "、".join(state.agent_outputs.context.style_constraints) or "无额外风格约束",
        "payload_json": json.dumps(payload, ensure_ascii=False, indent=2),
    }


def _apply_llm_feedback(
    state: AnalysisState,
    fallback_outputs: list[FeedbackOutput],
    *,
    config_path: str | Path | None = None,
) -> list[FeedbackOutput]:
    llm_cfg = resolve_runtime_llm_config()
    if not llm_cfg.enabled:
        return fallback_outputs

    try:
        client = RuntimeLLMClient(llm_cfg, config_path=config_path)
        prompt_variables = _build_feedback_prompt_variables(state)
        system_prompt = render_prompt_template(
            "feedback_system",
            variables=prompt_variables,
            config_path=config_path,
        )
        user_prompt = render_prompt_template(
            "feedback_user",
            variables=prompt_variables,
            config_path=config_path,
        )
        if prompt_debug_enabled():
            state.meta.setdefault("llm_prompts", {})["feedback"] = {
                "system_template_path": str(
                    resolve_prompt_template_path("feedback_system", config_path=config_path)
                ),
                "user_template_path": str(resolve_prompt_template_path("feedback_user", config_path=config_path)),
                "system_prompt": system_prompt,
                "user_prompt": user_prompt,
            }
        payload = client.chat_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            repair_schema_name="FeedbackSegmentsResult",
            repair_schema_json=load_prompt_template("feedback_repair_schema", config_path=config_path),
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


def synthesize_feedback(
    state: AnalysisState,
    config_path: str | Path | None = None,
    *,
    enable_llm: bool = True,
) -> AnalysisState:
    fallback_outputs = _build_feedback_fallback(state, config_path=config_path)
    if enable_llm:
        state.agent_outputs.feedback = _apply_llm_feedback(state, fallback_outputs, config_path=config_path)
    else:
        state.agent_outputs.feedback = fallback_outputs
    state.result.segment_results = [segment.model_copy(deep=True) for segment in state.segments]
    return state


def apply_feedback(
    state: AnalysisState,
    config_path: str | Path | None = None,
    *,
    enable_llm: bool = True,
) -> AnalysisState:
    """Backward-compatible wrapper for older call sites and tests."""
    return synthesize_feedback(state, config_path=config_path, enable_llm=enable_llm)
