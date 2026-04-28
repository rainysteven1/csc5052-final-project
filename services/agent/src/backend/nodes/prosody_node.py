"""Rule-based prosody analysis for the runtime pipeline."""

from __future__ import annotations

import json
from pathlib import Path

from services.agent.src.schemas.analysis import ProsodyOutput
from services.agent.src.services.artifact_loader import load_artifacts
from services.agent.src.backend.contracts.analysis_contracts import SegmentFeatureMap
from services.agent.src.backend.tools import (
    LLMClientError,
    RuntimeLLMClient,
    load_prompt_template,
    prompt_debug_enabled,
    render_prompt_template,
    resolve_prompt_template_path,
    resolve_runtime_llm_config,
)
from services.agent.src.backend.tools.feature_extractor import extract_segment_features
from services.agent.src.backend.tools.rule_loader import load_prosody_rules
from services.agent.src.state import AnalysisState


def _resolve_prosody_provider(
    state: AnalysisState,
    *,
    config_path: str | Path | None = None,
) -> str:
    configured = str(state.artifacts.providers.get("prosody", "")).strip().lower()
    if configured:
        return configured
    try:
        artifacts = load_artifacts(config_path=config_path)
    except Exception:
        return "rule"
    return str(artifacts.metadata.providers.get("prosody", "rule")).strip().lower() or "rule"


def _build_prosody_prompt_variables(
    *,
    scenario: str,
    segment_text: str,
    output: ProsodyOutput,
) -> dict[str, str]:
    payload = {
        "scenario": scenario,
        "segment_id": output.segment_id,
        "segment_text": segment_text,
        "score": output.score,
        "features": output.features,
        "explanations": output.explanations,
    }
    return {
        "scenario": scenario,
        "payload_json": json.dumps(payload, ensure_ascii=False, indent=2),
    }


def _apply_prosody_llm_interpretation(
    state: AnalysisState,
    outputs: list[ProsodyOutput],
    *,
    config_path: str | Path | None = None,
) -> list[ProsodyOutput]:
    llm_cfg = resolve_runtime_llm_config()
    if not llm_cfg.enabled:
        return outputs

    try:
        client = RuntimeLLMClient(llm_cfg, config_path=config_path)
    except LLMClientError as exc:
        state.add_warning(f"Prosody LLM unavailable: {exc}")
        return outputs

    segment_by_id = {segment.segment_id: segment for segment in state.segments}
    enriched: list[ProsodyOutput] = []
    llm_meta: dict[str, dict[str, str]] = {}

    for output in outputs:
        if not output.features or (output.score or 0.0) <= 0:
            enriched.append(output)
            continue

        segment = segment_by_id.get(output.segment_id)
        if segment is None:
            enriched.append(output)
            continue

        prompt_variables = _build_prosody_prompt_variables(
            scenario=state.scenario,
            segment_text=segment.text,
            output=output,
        )
        system_prompt = render_prompt_template(
            "prosody_system",
            variables=prompt_variables,
            config_path=config_path,
        )
        user_prompt = render_prompt_template(
            "prosody_user",
            variables=prompt_variables,
            config_path=config_path,
        )
        if prompt_debug_enabled():
            state.meta.setdefault("llm_prompts", {}).setdefault("prosody", {})[output.segment_id] = {
                "system_template_path": str(resolve_prompt_template_path("prosody_system", config_path=config_path)),
                "user_template_path": str(resolve_prompt_template_path("prosody_user", config_path=config_path)),
                "system_prompt": system_prompt,
                "user_prompt": user_prompt,
            }

        try:
            payload = client.chat_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                repair_schema_name="ProsodyResult",
                repair_schema_json=load_prompt_template("prosody_repair_schema", config_path=config_path),
            )
        except LLMClientError as exc:
            state.add_warning(f"Prosody interpretation fallback for {output.segment_id}: {exc}")
            enriched.append(output)
            continue

        llm_meta[output.segment_id] = {"provider": client.provider, "model": client.model}
        merged = output.model_copy(deep=True)
        interpretation = str(payload.get("interpretation", "")).strip()
        coaching_hint = str(payload.get("coaching_hint", "")).strip()
        feedback_focus = str(payload.get("feedback_focus", "")).strip()
        if interpretation:
            merged.interpretation = interpretation
            if interpretation not in merged.explanations:
                merged.explanations.append(interpretation)
        if coaching_hint:
            merged.coaching_hint = coaching_hint
        if feedback_focus:
            merged.feedback_focus = feedback_focus
        merged.provider = client.provider
        merged.model = client.model
        enriched.append(merged)

    if llm_meta:
        state.meta["llm_prosody"] = llm_meta
    return enriched


def analyze_prosody(
    state: AnalysisState,
    config_path: str | Path | None = None,
) -> AnalysisState:
    prosody_provider = _resolve_prosody_provider(state, config_path=config_path)
    audio_path = state.audio.normalized_path or state.audio.source_path
    resolved_audio = Path(audio_path).expanduser().resolve()
    rules = load_prosody_rules(config_path=config_path)
    outputs: list[ProsodyOutput] = []

    for segment in state.segments:
        features: SegmentFeatureMap = extract_segment_features(resolved_audio, segment)
        score = 0.0
        explanations: list[str] = []

        speech_rate = features["speech_rate"]
        pause_duration = features["pause_duration"]
        energy_var = features["energy_var"]
        pitch_var = features["pitch_var"]

        if speech_rate < rules.speech_rate.slow_threshold:
            score += min(
                (rules.speech_rate.slow_threshold - speech_rate) * rules.speech_rate.slow_weight,
                rules.speech_rate.slow_cap,
            )
            explanations.append(rules.speech_rate.slow_explanation)
        elif speech_rate > rules.speech_rate.fast_threshold:
            score += min(
                (speech_rate - rules.speech_rate.fast_threshold) * rules.speech_rate.fast_weight,
                rules.speech_rate.fast_cap,
            )
            explanations.append(rules.speech_rate.fast_explanation)

        if pause_duration >= rules.pause.threshold:
            score += min(pause_duration * rules.pause.weight, rules.pause.cap)
            explanations.append(rules.pause.explanation)

        if energy_var < rules.energy.flat_threshold and (segment.end - segment.start) >= rules.energy.min_duration:
            score += rules.energy.penalty
            explanations.append(rules.energy.explanation)

        if pitch_var < rules.pitch.flat_threshold and (segment.end - segment.start) >= rules.pitch.min_duration:
            score += rules.pitch.penalty
            explanations.append(rules.pitch.explanation)

        bounded_score = round(min(score, 1.0), 3)
        segment.scores.prosody = bounded_score

        outputs.append(
            ProsodyOutput(
                segment_id=segment.segment_id,
                score=bounded_score,
                features=features,
                explanations=explanations,
            )
        )

    if prosody_provider in {"llm", "hybrid"}:
        outputs = _apply_prosody_llm_interpretation(state, outputs, config_path=config_path)

    state.agent_outputs.prosody = outputs
    return state
