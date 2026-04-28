"""Rule-based lexical uncertainty detection for the runtime pipeline."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path

from services.agent.src.schemas.analysis import LexicalOutput, SegmentHighlight
from services.agent.src.services.artifact_loader import load_artifacts
from services.agent.src.backend.tools import (
    LLMClientError,
    RuntimeLLMClient,
    load_prompt_template,
    prompt_debug_enabled,
    render_prompt_template,
    resolve_prompt_template_path,
    resolve_runtime_llm_config,
)
from services.agent.src.backend.tools.text_rewrite import build_lexical_rewrite
from services.agent.src.backend.tools.rule_loader import load_lexical_rules
from services.agent.src.state import AnalysisState


@dataclass(frozen=True)
class LexicalRule:
    phrase: str
    weight: float
    explanation: str


def _resolve_lexical_provider(
    state: AnalysisState,
    *,
    config_path: str | Path | None = None,
) -> str:
    configured = str(state.artifacts.providers.get("lexical", "")).strip().lower()
    if configured:
        return configured
    try:
        artifacts = load_artifacts(config_path=config_path)
    except Exception:
        return "rule"
    return str(artifacts.metadata.providers.get("lexical", "rule")).strip().lower() or "rule"


def _build_lexical_prompt_variables(
    *,
    scenario: str,
    segment_text: str,
    lexical_output: LexicalOutput,
) -> dict[str, str]:
    payload = {
        "scenario": scenario,
        "segment_id": lexical_output.segment_id,
        "segment_text": segment_text,
        "score": lexical_output.score,
        "triggers": lexical_output.triggers,
        "explanations": lexical_output.explanations,
    }
    return {
        "scenario": scenario,
        "payload_json": json.dumps(payload, ensure_ascii=False, indent=2),
    }


def _apply_lexical_llm_interpretation(
    state: AnalysisState,
    outputs: list[LexicalOutput],
    *,
    config_path: str | Path | None = None,
) -> list[LexicalOutput]:
    llm_cfg = resolve_runtime_llm_config()
    if not llm_cfg.enabled:
        return outputs

    try:
        client = RuntimeLLMClient(llm_cfg, config_path=config_path)
    except LLMClientError as exc:
        state.add_warning(f"Lexical LLM unavailable: {exc}")
        return outputs

    segment_by_id = {segment.segment_id: segment for segment in state.segments}
    enriched: list[LexicalOutput] = []
    llm_meta: dict[str, dict[str, str]] = {}

    for output in outputs:
        if not output.triggers:
            enriched.append(output)
            continue

        segment = segment_by_id.get(output.segment_id)
        if segment is None:
            enriched.append(output)
            continue

        prompt_variables = _build_lexical_prompt_variables(
            scenario=state.scenario,
            segment_text=segment.text,
            lexical_output=output,
        )
        system_prompt = render_prompt_template(
            "lexical_system",
            variables=prompt_variables,
            config_path=config_path,
        )
        user_prompt = render_prompt_template(
            "lexical_user",
            variables=prompt_variables,
            config_path=config_path,
        )
        if prompt_debug_enabled():
            state.meta.setdefault("llm_prompts", {}).setdefault("lexical", {})[output.segment_id] = {
                "system_template_path": str(resolve_prompt_template_path("lexical_system", config_path=config_path)),
                "user_template_path": str(resolve_prompt_template_path("lexical_user", config_path=config_path)),
                "system_prompt": system_prompt,
                "user_prompt": user_prompt,
            }

        try:
            payload = client.chat_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                repair_schema_name="LexicalResult",
                repair_schema_json=load_prompt_template("lexical_repair_schema", config_path=config_path),
            )
        except LLMClientError as exc:
            state.add_warning(f"Lexical interpretation fallback for {output.segment_id}: {exc}")
            enriched.append(output)
            continue

        llm_meta[output.segment_id] = {"provider": client.provider, "model": client.model}
        merged = output.model_copy(deep=True)
        interpretation = str(payload.get("interpretation", "")).strip()
        rewrite_hint = str(payload.get("rewrite_hint", "")).strip()
        practice_hint = str(payload.get("practice_hint", "")).strip()
        if interpretation:
            merged.interpretation = interpretation
            if interpretation not in merged.explanations:
                merged.explanations.append(interpretation)
        if rewrite_hint:
            merged.rewrite_hint = rewrite_hint
        if practice_hint:
            merged.practice_hint = practice_hint
        merged.provider = client.provider
        merged.model = client.model
        enriched.append(merged)

    if llm_meta:
        state.meta["llm_lexical"] = llm_meta
    return enriched


def _find_all_occurrences(text: str, phrase: str) -> list[tuple[int, int]]:
    lowered = text.lower()
    lowered_phrase = phrase.lower()
    results: list[tuple[int, int]] = []
    start = 0
    while True:
        idx = lowered.find(lowered_phrase, start)
        if idx < 0:
            return results
        results.append((idx, idx + len(phrase)))
        start = idx + len(phrase)


def analyze_lexical_uncertainty(
    state: AnalysisState,
    config_path: str | Path | None = None,
) -> AnalysisState:
    lexical_provider = _resolve_lexical_provider(state, config_path=config_path)
    lexical_rules = tuple(
        LexicalRule(rule.phrase, rule.weight, rule.explanation)
        for rule in load_lexical_rules(config_path=config_path)
    )
    outputs: list[LexicalOutput] = []

    for segment in state.segments:
        text = segment.text.strip()
        text_lower = text.lower()
        triggers: list[str] = []
        explanations: list[str] = []
        highlights: list[SegmentHighlight] = []
        score = 0.0

        for rule in lexical_rules:
            if rule.phrase not in text_lower and rule.phrase not in text:
                continue
            occurrences = _find_all_occurrences(text, rule.phrase)
            if not occurrences and rule.phrase != rule.phrase.lower():
                occurrences = _find_all_occurrences(text, rule.phrase.lower())
            if not occurrences and rule.phrase in text:
                occurrences = [(text.index(rule.phrase), text.index(rule.phrase) + len(rule.phrase))]
            if not occurrences:
                continue

            score += rule.weight * len(occurrences)
            matched_text = text[occurrences[0][0] : occurrences[0][1]]
            if matched_text not in triggers:
                triggers.append(matched_text)
            if rule.explanation not in explanations:
                explanations.append(rule.explanation)
            for start_char, end_char in occurrences:
                highlights.append(
                    SegmentHighlight(
                        type="trigger",
                        text=text[start_char:end_char],
                        start_char=start_char,
                        end_char=end_char,
                    )
                )

        bounded_score = round(min(score, 1.0), 3)
        segment.scores.lexical = bounded_score
        segment.highlights = highlights

        outputs.append(
            LexicalOutput(
                segment_id=segment.segment_id,
                score=bounded_score,
                triggers=[highlight.text for highlight in highlights],
                explanations=explanations,
            )
        )

    if lexical_provider in {"llm", "hybrid"}:
        outputs = _apply_lexical_llm_interpretation(state, outputs, config_path=config_path)

    state.agent_outputs.lexical = outputs
    return state
