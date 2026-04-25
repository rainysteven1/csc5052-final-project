"""Reasoning node for deterministic fusion plus optional MiniMax summary."""

from __future__ import annotations

import json
from typing import Any

from services.agent.src.logger import logger
from services.agent.src.services.agent.contracts.analysis_contracts import ReasoningPayload, ScorePayload
from services.agent.src.services.agent.tools.llm_client import (
    LLMClientError,
    RuntimeLLMClient,
    resolve_runtime_llm_config,
)
from services.agent.src.services.agent.tools.prompt_loader import (
    load_prompt_template,
    prompt_debug_enabled,
    render_prompt_template,
    resolve_prompt_template_path,
)
from services.agent.src.services.agent.tools.scorer import score_state
from services.agent.src.state import AnalysisState


def _build_reasoning_prompt_variables(state: AnalysisState, score_payload: ScorePayload) -> dict[str, str]:
    segment_payload = []
    for segment in state.segments:
        segment_payload.append(
            {
                "segment_id": segment.segment_id,
                "text": segment.text,
                "scores": segment.scores.model_dump(mode="json"),
                "highlights": [item.model_dump(mode="json") for item in segment.highlights],
            }
        )

    payload = {
        "scenario": state.scenario,
        "context": state.agent_outputs.context.model_dump(mode="json"),
        "score_payload": score_payload,
        "segments": segment_payload,
        "warnings": state.warnings,
    }
    return {
        "scenario": state.scenario,
        "payload_json": json.dumps(payload, ensure_ascii=False, indent=2),
    }


def apply_reasoning(state: AnalysisState) -> AnalysisState:
    score_payload = score_state(state)
    reasoning_payload: ReasoningPayload = {
        "overall_score": score_payload["overall_score"],
        "level": score_payload["level"],
        "dominant_causes": score_payload["dominant_causes"],
        "lexical_average": score_payload["lexical_average"],
        "prosody_average": score_payload["prosody_average"],
        "disfluency_average": score_payload["disfluency_average"],
    }

    state.result.overall_score = score_payload["overall_score"]
    state.result.level = score_payload["level"]
    state.result.dominant_causes = score_payload["dominant_causes"]
    state.result.summary = score_payload["summary"]

    llm_cfg = resolve_runtime_llm_config()
    if llm_cfg.enabled:
        try:
            client = RuntimeLLMClient(llm_cfg)
            prompt_variables = _build_reasoning_prompt_variables(state, score_payload)
            system_prompt = render_prompt_template("reasoning_system", variables=prompt_variables)
            user_prompt = render_prompt_template("reasoning_user", variables=prompt_variables)
            if prompt_debug_enabled():
                state.meta.setdefault("llm_prompts", {})["reasoning"] = {
                    "system_template_path": str(resolve_prompt_template_path("reasoning_system")),
                    "user_template_path": str(resolve_prompt_template_path("reasoning_user")),
                    "system_prompt": system_prompt,
                    "user_prompt": user_prompt,
                }
            llm_payload = client.chat_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                repair_schema_name="ReasoningResult",
                repair_schema_json=load_prompt_template("reasoning_repair_schema"),
            )
            llm_summary = str(llm_payload.get("summary", "")).strip()
            if llm_summary:
                state.result.summary = llm_summary
                reasoning_payload["llm_summary"] = llm_summary
            llm_causes = llm_payload.get("dominant_causes")
            if isinstance(llm_causes, list):
                reasoning_payload["llm_dominant_causes"] = [str(item) for item in llm_causes]
            coaching_focus = llm_payload.get("coaching_focus")
            if isinstance(coaching_focus, list):
                reasoning_payload["coaching_focus"] = [str(item) for item in coaching_focus]
            reasoning_payload["provider"] = client.provider
            reasoning_payload["model"] = client.model
            state.meta["llm_reasoning"] = {"provider": client.provider, "model": client.model}
        except LLMClientError as exc:
            state.add_warning(f"Reasoning LLM unavailable: {exc}")
            logger.warning("[Reasoning] Falling back to deterministic summary: {}", exc)

    state.agent_outputs.reasoning = reasoning_payload
    state.result.segment_results = [segment.model_copy(deep=True) for segment in state.segments]
    return state
