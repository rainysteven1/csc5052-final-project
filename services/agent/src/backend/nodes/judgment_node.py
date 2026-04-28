"""Judgment synthesis for deterministic fusion plus optional LLM refinement."""

from __future__ import annotations

import json
from pathlib import Path

from services.agent.src.backend.contracts.analysis_contracts import (
    JudgmentPayload,
    ScorePayload,
)
from services.agent.src.backend.tools import (
    LLMClientError,
    RuntimeLLMClient,
    load_prompt_template,
    prompt_debug_enabled,
    render_prompt_template,
    resolve_prompt_template_path,
    resolve_runtime_llm_config,
    score_state,
)
from services.agent.src.language import normalize_runtime_language, resolve_prompt_language
from services.agent.src.logger import logger
from services.agent.src.schemas.analysis import JudgmentOutput
from services.agent.src.state import AnalysisState

FOCUS_LABELS = {
    "en": {
        "lexical": "Replace hedging with a more direct core statement",
        "prosody": "Stabilize pacing, pauses, and sentence contour first",
        "disfluency": "Reduce fillers, repetition, and self-repairs first",
    },
    "zh": {
        "lexical": "优先去掉模糊词并直接表达核心观点",
        "prosody": "优先稳定语速、停顿和句子起伏",
        "disfluency": "优先消除填充词、重复和自我修正",
    },
}

STRENGTH_LABELS = {
    "en": {
        "lexical": "Wording stays mostly direct",
        "prosody": "Pacing and pauses stay mostly stable",
        "disfluency": "Delivery stays mostly clean",
    },
    "zh": {
        "lexical": "措辞整体较直接",
        "prosody": "节奏与停顿整体较稳定",
        "disfluency": "语流整体较干净",
    },
}
DEFAULT_CONTEXT_FOCUS = {
    "en": "Keep the delivery stable while staying focused on: {item}",
    "zh": "保持当前风格，同时继续关注：{item}",
}
DEFAULT_FALLBACK_FOCUS = {
    "en": "Maintain the current delivery and keep reviewing short speaking units",
    "zh": "保持当前表达稳定性，并持续做短句复盘",
}
DEFAULT_GLOBAL_STRENGTH = {
    "en": "Overall intelligibility stays solid",
    "zh": "整体表达可懂度较好",
}

CAUSE_TO_DIMENSION = {
    "lexical_uncertainty": "lexical",
    "prosody": "prosody",
    "disfluency": "disfluency",
}


def _dedupe(items: list[str], *, limit: int | None = None) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        cleaned = str(item).strip()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        result.append(cleaned)
        if limit is not None and len(result) >= limit:
            break
    return result


def _resolve_runtime_language(state: AnalysisState) -> str:
    return resolve_prompt_language(state.meta) or "zh"


def _build_coaching_focus(
    state: AnalysisState,
    score_payload: ScorePayload,
    *,
    runtime_language: str,
) -> list[str]:
    focus: list[str] = []
    focus_labels = FOCUS_LABELS[runtime_language]
    for cause in score_payload["dominant_causes"]:
        dimension = CAUSE_TO_DIMENSION.get(cause)
        if dimension is not None:
            focus.append(focus_labels[dimension])

    for dimension in state.agent_outputs.evidence_summary.dominant_dimensions:
        if dimension in focus_labels:
            focus.append(focus_labels[dimension])

    if not focus:
        focus.extend(
            DEFAULT_CONTEXT_FOCUS[runtime_language].format(item=item)
            for item in state.agent_outputs.context.style_constraints[:2]
        )

    if not focus:
        focus.append(DEFAULT_FALLBACK_FOCUS[runtime_language])

    return _dedupe(focus, limit=3)


def _build_strengths(score_payload: ScorePayload, *, runtime_language: str) -> list[str]:
    strengths: list[str] = []
    strength_labels = STRENGTH_LABELS[runtime_language]
    averages = {
        "lexical": score_payload["lexical_average"],
        "prosody": score_payload["prosody_average"],
        "disfluency": score_payload["disfluency_average"],
    }
    for dimension, score in averages.items():
        if score <= 0.05:
            strengths.append(strength_labels[dimension])

    if not strengths and score_payload["risk_score"] <= 0.2:
        strengths.append(DEFAULT_GLOBAL_STRENGTH[runtime_language])

    return _dedupe(strengths, limit=3)


def _build_deterministic_judgment(
    state: AnalysisState,
    score_payload: ScorePayload,
    *,
    runtime_language: str,
) -> JudgmentPayload:
    evidence_summary = state.agent_outputs.evidence_summary
    return {
        "summary": score_payload["summary"],
        "dominant_causes": list(score_payload["dominant_causes"]),
        "coaching_focus": _build_coaching_focus(
            state,
            score_payload,
            runtime_language=runtime_language,
        ),
        "risk_segments": [item.segment_id for item in evidence_summary.risk_segments],
        "strengths": _build_strengths(score_payload, runtime_language=runtime_language),
        "overall_score": score_payload["overall_score"],
        "risk_score": score_payload["risk_score"],
        "level": score_payload["level"],
    }


def _build_judgment_prompt_variables(
    state: AnalysisState,
    score_payload: ScorePayload,
    judgment_payload: JudgmentPayload,
) -> dict[str, str]:
    payload = {
        "scenario": state.scenario,
        "context": state.agent_outputs.context.model_dump(mode="json"),
        "score_payload": score_payload,
        "evidence_summary": state.agent_outputs.evidence_summary.model_dump(mode="json"),
        "deterministic_judgment": judgment_payload,
        "warnings": state.warnings,
    }
    return {
        "scenario": state.scenario,
        "payload_json": json.dumps(payload, ensure_ascii=False, indent=2),
    }


def _merge_judgment_payload(
    base_payload: JudgmentPayload,
    llm_payload: dict[str, object],
) -> JudgmentPayload:
    merged: JudgmentPayload = dict(base_payload)

    summary = str(llm_payload.get("summary", "")).strip()
    if summary:
        merged["summary"] = summary

    for field in ("dominant_causes", "coaching_focus", "risk_segments", "strengths"):
        value = llm_payload.get(field)
        if isinstance(value, list):
            merged[field] = _dedupe([str(item) for item in value])

    return merged


def synthesize_judgment(
    state: AnalysisState,
    config_path: str | Path | None = None,
    *,
    enable_llm: bool = True,
) -> AnalysisState:
    runtime_language = _resolve_runtime_language(state)
    score_payload = score_state(state, config_path=str(config_path) if config_path is not None else None)
    judgment_payload = _build_deterministic_judgment(
        state,
        score_payload,
        runtime_language=runtime_language,
    )

    state.result.overall_score = score_payload["overall_score"]
    state.result.risk_score = score_payload["risk_score"]
    state.result.level = score_payload["level"]
    state.result.dominant_causes = list(judgment_payload["dominant_causes"])
    state.result.summary = judgment_payload["summary"]

    llm_cfg = resolve_runtime_llm_config()
    if enable_llm and llm_cfg.enabled:
        try:
            client = RuntimeLLMClient(llm_cfg, config_path=config_path)
            prompt_variables = _build_judgment_prompt_variables(state, score_payload, judgment_payload)
            system_prompt = render_prompt_template(
                "judgment_system",
                variables=prompt_variables,
                config_path=config_path,
                language=runtime_language,
            )
            user_prompt = render_prompt_template(
                "judgment_user",
                variables=prompt_variables,
                config_path=config_path,
                language=runtime_language,
            )
            if prompt_debug_enabled():
                prompt_payload = {
                    "system_template_path": str(
                        resolve_prompt_template_path(
                            "judgment_system",
                            config_path=config_path,
                            language=runtime_language,
                        )
                    ),
                    "user_template_path": str(
                        resolve_prompt_template_path(
                            "judgment_user",
                            config_path=config_path,
                            language=runtime_language,
                        )
                    ),
                    "system_prompt": system_prompt,
                    "user_prompt": user_prompt,
                }
                state.meta.setdefault("llm_prompts", {})["judgment"] = prompt_payload
            llm_payload = client.chat_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                repair_schema_name="JudgmentResult",
                repair_schema_json=load_prompt_template(
                    "judgment_repair_schema",
                    config_path=config_path,
                    language=runtime_language,
                ),
                repair_language=runtime_language,
            )
            judgment_payload = _merge_judgment_payload(judgment_payload, llm_payload)
            judgment_payload["provider"] = client.provider
            judgment_payload["model"] = client.model
            state.meta["llm_judgment"] = {"provider": client.provider, "model": client.model}
        except LLMClientError as exc:
            state.add_warning(f"Judgment LLM unavailable: {exc}")
            logger.warning("[Judgment] Falling back to deterministic summary: {}", exc)

    state.result.summary = str(judgment_payload.get("summary") or score_payload["summary"]).strip()
    state.result.dominant_causes = [
        str(item) for item in (judgment_payload.get("dominant_causes") or score_payload["dominant_causes"])
    ]

    state.agent_outputs.judgment = JudgmentOutput.model_validate(judgment_payload)
    state.result.segment_results = [segment.model_copy(deep=True) for segment in state.segments]
    return state
