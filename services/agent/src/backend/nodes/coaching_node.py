"""Unified coaching node that owns deterministic fusion plus optional LLM synthesis."""

from __future__ import annotations

import json
from pathlib import Path

from services.agent.src.logger import logger
from services.agent.src.schemas.analysis import CoachingOutput, FeedbackOutput, SegmentFeedback
from services.agent.src.services.artifact_loader import load_artifacts
from services.agent.src.backend.contracts.analysis_contracts import CoachingPayload, FeedbackSegmentPayload
from services.agent.src.backend.nodes.feedback_node import synthesize_feedback
from services.agent.src.backend.nodes.judgment_node import synthesize_judgment
from services.agent.src.backend.tools import (
    LLMClientError,
    RuntimeLLMClient,
    load_prompt_template,
    prompt_debug_enabled,
    render_prompt_template,
    resolve_prompt_template_path,
    resolve_runtime_llm_config,
)
from services.agent.src.state import AnalysisState


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        cleaned = str(item).strip()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        result.append(cleaned)
    return result


def _resolve_coaching_provider(
    state: AnalysisState,
    *,
    config_path: str | Path | None = None,
) -> str:
    configured = str(state.artifacts.providers.get("coaching", "")).strip().lower()
    if configured:
        return configured
    try:
        artifacts = load_artifacts(config_path=config_path)
    except Exception:
        return "disabled"
    return str(artifacts.metadata.providers.get("coaching", "disabled")).strip().lower() or "disabled"


def _build_coaching_prompt_variables(state: AnalysisState) -> dict[str, str]:
    payload = {
        "scenario": state.scenario,
        "context": state.agent_outputs.context.model_dump(mode="json"),
        "evidence_summary": state.agent_outputs.evidence_summary.model_dump(mode="json"),
        "judgment": state.agent_outputs.judgment.model_dump(mode="json"),
        "feedback": [item.model_dump(mode="json") for item in state.agent_outputs.feedback],
        "warnings": state.warnings,
    }
    return {
        "scenario": state.scenario,
        "payload_json": json.dumps(payload, ensure_ascii=False, indent=2),
    }


def _merge_feedback_outputs(
    state: AnalysisState,
    generated_segments: list[FeedbackSegmentPayload],
) -> None:
    by_segment = {item.segment_id: item for item in state.agent_outputs.feedback}

    for item in generated_segments:
        segment_id = str(item.get("segment_id", "")).strip()
        if not segment_id or segment_id not in by_segment:
            continue

        existing = by_segment[segment_id]
        merged = FeedbackOutput(
            segment_id=segment_id,
            severity=str(item.get("severity") or existing.severity or "low"),
            focus_tags=[str(tag) for tag in item.get("focus_tags", existing.focus_tags) or existing.focus_tags],
            problem=str(item.get("reason") or existing.problem or ""),
            rewrite=str(item.get("rewrite") or existing.rewrite or ""),
            practice=str(item.get("practice") or existing.practice or ""),
            practice_steps=[
                str(step)
                for step in (item.get("practice_steps") or existing.practice_steps or [])
                if str(step).strip()
            ],
        )
        by_segment[segment_id] = merged

    state.agent_outputs.feedback = [by_segment[segment.segment_id] for segment in state.segments if segment.segment_id in by_segment]
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


def apply_coaching(
    state: AnalysisState,
    config_path: str | Path | None = None,
) -> AnalysisState:
    # Always establish deterministic judgment and segment feedback first so the
    # coaching node can be the single synthesis stage while preserving fallback safety.
    state = synthesize_judgment(state, config_path=config_path, enable_llm=False)
    state = synthesize_feedback(state, config_path=config_path, enable_llm=False)

    provider = _resolve_coaching_provider(state, config_path=config_path)
    normalized_focus = list(state.agent_outputs.judgment.coaching_focus)
    normalized_strengths = list(state.agent_outputs.judgment.strengths)
    state.agent_outputs.coaching = CoachingOutput(
        summary=state.result.summary,
        coaching_focus=normalized_focus,
        strengths=normalized_strengths,
    )
    state.result.segment_results = [segment.model_copy(deep=True) for segment in state.segments]

    if provider not in {"llm", "hybrid"}:
        return state

    llm_cfg = resolve_runtime_llm_config()
    if not llm_cfg.enabled:
        return state

    try:
        client = RuntimeLLMClient(llm_cfg, config_path=config_path)
        prompt_variables = _build_coaching_prompt_variables(state)
        system_prompt = render_prompt_template(
            "coaching_system",
            variables=prompt_variables,
            config_path=config_path,
        )
        user_prompt = render_prompt_template(
            "coaching_user",
            variables=prompt_variables,
            config_path=config_path,
        )
        if prompt_debug_enabled():
            state.meta.setdefault("llm_prompts", {})["coaching"] = {
                "system_template_path": str(resolve_prompt_template_path("coaching_system", config_path=config_path)),
                "user_template_path": str(resolve_prompt_template_path("coaching_user", config_path=config_path)),
                "system_prompt": system_prompt,
                "user_prompt": user_prompt,
            }
        payload = client.chat_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            repair_schema_name="CoachingResult",
            repair_schema_json=load_prompt_template("coaching_repair_schema", config_path=config_path),
        )
    except LLMClientError as exc:
        state.add_warning(f"Coaching LLM unavailable: {exc}")
        logger.warning("[Coaching] Falling back to deterministic coaching package: {}", exc)
        return state

    coaching_payload = CoachingPayload(**payload)
    summary = str(coaching_payload.get("summary", "")).strip()
    if summary:
        state.result.summary = summary
        state.agent_outputs.judgment.summary = summary

    focus = coaching_payload.get("coaching_focus")
    if isinstance(focus, list):
        normalized_focus = _dedupe([str(item) for item in focus])
        state.agent_outputs.judgment.coaching_focus = normalized_focus
    strengths = coaching_payload.get("strengths")
    if isinstance(strengths, list):
        normalized_strengths = _dedupe([str(item) for item in strengths])
        state.agent_outputs.judgment.strengths = normalized_strengths

    segments = coaching_payload.get("segments")
    if isinstance(segments, list):
        typed_segments = [FeedbackSegmentPayload(**item) for item in segments if isinstance(item, dict)]
        _merge_feedback_outputs(state, typed_segments)

    state.agent_outputs.coaching = CoachingOutput(
        summary=state.result.summary,
        coaching_focus=normalized_focus,
        strengths=normalized_strengths,
        provider=client.provider,
        model=client.model,
    )
    state.meta["llm_coaching"] = {"provider": client.provider, "model": client.model}
    state.result.segment_results = [segment.model_copy(deep=True) for segment in state.segments]
    return state
