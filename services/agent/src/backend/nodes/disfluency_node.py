"""Rule-based disfluency detection for the runtime pipeline."""

from __future__ import annotations

import json
import re
from pathlib import Path

from services.agent.src.backend.tools import (
    LLMClientError,
    RuntimeLLMClient,
    load_prompt_template,
    prompt_debug_enabled,
    render_prompt_template,
    resolve_prompt_template_path,
    resolve_runtime_llm_config,
)
from services.agent.src.backend.tools.rule_loader import DisfluencyRulesConfig, load_disfluency_rules
from services.agent.src.language import normalize_runtime_language, resolve_prompt_language
from services.agent.src.schemas.analysis import DisfluencyIssue, DisfluencyOutput, SegmentHighlight
from services.agent.src.services.artifact_loader import load_artifacts
from services.agent.src.state import AnalysisState


def _resolve_disfluency_provider(
    state: AnalysisState,
    *,
    config_path: str | Path | None = None,
) -> str:
    configured = str(state.artifacts.providers.get("disfluency", "")).strip().lower()
    if configured:
        return configured
    try:
        artifacts = load_artifacts(config_path=config_path)
    except Exception:
        return "rule"
    return str(artifacts.metadata.providers.get("disfluency", "rule")).strip().lower() or "rule"


def _resolve_runtime_language(state: AnalysisState) -> str | None:
    return resolve_prompt_language(state.meta)


def _build_disfluency_prompt_variables(
    *,
    scenario: str,
    segment_text: str,
    output: DisfluencyOutput,
) -> dict[str, str]:
    payload = {
        "scenario": scenario,
        "segment_id": output.segment_id,
        "segment_text": segment_text,
        "score": output.score,
        "issues": [item.model_dump(mode="json") for item in output.issues],
        "explanations": output.explanations,
    }
    return {
        "scenario": scenario,
        "payload_json": json.dumps(payload, ensure_ascii=False, indent=2),
    }


def _apply_disfluency_llm_interpretation(
    state: AnalysisState,
    outputs: list[DisfluencyOutput],
    *,
    config_path: str | Path | None = None,
) -> list[DisfluencyOutput]:
    runtime_language = _resolve_runtime_language(state)
    llm_cfg = resolve_runtime_llm_config()
    if not llm_cfg.enabled:
        return outputs

    try:
        client = RuntimeLLMClient(llm_cfg, config_path=config_path)
    except LLMClientError as exc:
        state.add_warning(f"Disfluency LLM unavailable: {exc}")
        return outputs

    segment_by_id = {segment.segment_id: segment for segment in state.segments}
    enriched: list[DisfluencyOutput] = []
    llm_meta: dict[str, dict[str, str]] = {}

    for output in outputs:
        if not output.issues:
            enriched.append(output)
            continue

        segment = segment_by_id.get(output.segment_id)
        if segment is None:
            enriched.append(output)
            continue

        prompt_variables = _build_disfluency_prompt_variables(
            scenario=state.scenario,
            segment_text=segment.text,
            output=output,
        )
        system_prompt = render_prompt_template(
            "disfluency_system",
            variables=prompt_variables,
            config_path=config_path,
            language=runtime_language,
        )
        user_prompt = render_prompt_template(
            "disfluency_user",
            variables=prompt_variables,
            config_path=config_path,
            language=runtime_language,
        )
        if prompt_debug_enabled():
            state.meta.setdefault("llm_prompts", {}).setdefault("disfluency", {})[output.segment_id] = {
                "system_template_path": str(
                    resolve_prompt_template_path(
                        "disfluency_system",
                        config_path=config_path,
                        language=runtime_language,
                    )
                ),
                "user_template_path": str(
                    resolve_prompt_template_path(
                        "disfluency_user",
                        config_path=config_path,
                        language=runtime_language,
                    )
                ),
                "system_prompt": system_prompt,
                "user_prompt": user_prompt,
            }

        try:
            payload = client.chat_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                repair_schema_name="DisfluencyResult",
                repair_schema_json=load_prompt_template(
                    "disfluency_repair_schema",
                    config_path=config_path,
                    language=runtime_language,
                ),
                repair_language=runtime_language,
            )
        except LLMClientError as exc:
            state.add_warning(f"Disfluency interpretation fallback for {output.segment_id}: {exc}")
            enriched.append(output)
            continue

        llm_meta[output.segment_id] = {"provider": client.provider, "model": client.model}
        merged = output.model_copy(deep=True)
        interpretation = str(payload.get("interpretation", "")).strip()
        practice_hint = str(payload.get("practice_hint", "")).strip()
        feedback_focus = str(payload.get("feedback_focus", "")).strip()
        if interpretation:
            merged.interpretation = interpretation
            if interpretation not in merged.explanations:
                merged.explanations.append(interpretation)
        if practice_hint:
            merged.practice_hint = practice_hint
        if feedback_focus:
            merged.feedback_focus = feedback_focus
        merged.provider = client.provider
        merged.model = client.model
        enriched.append(merged)

    if llm_meta:
        state.meta["llm_disfluency"] = llm_meta
    return enriched


def _collect_fillers(
    text: str,
    rules: DisfluencyRulesConfig,
) -> tuple[list[DisfluencyIssue], list[SegmentHighlight], float]:
    issues: list[DisfluencyIssue] = []
    highlights: list[SegmentHighlight] = []
    score = 0.0

    for item in rules.filler_patterns:
        matches = list(re.finditer(item.pattern, text, flags=re.IGNORECASE))
        if not matches:
            continue
        issues.append(DisfluencyIssue(type="filler", text=item.label, count=len(matches)))
        score += rules.scoring.filler_weight * len(matches)
        for match in matches:
            highlights.append(
                SegmentHighlight(
                    type="filler",
                    text=match.group(0),
                    start_char=match.start(),
                    end_char=match.end(),
                )
            )

    return issues, highlights, score


def _collect_repetitions(
    text: str,
    rules: DisfluencyRulesConfig,
) -> tuple[list[DisfluencyIssue], list[SegmentHighlight], float]:
    token_pattern = re.compile(rules.scoring.repetition_token_pattern, flags=re.IGNORECASE)
    tokens = list(token_pattern.finditer(text))
    issues: list[DisfluencyIssue] = []
    highlights: list[SegmentHighlight] = []
    score = 0.0

    i = 0
    while i < len(tokens) - 1:
        current = tokens[i]
        nxt = tokens[i + 1]
        if current.group(0).lower() != nxt.group(0).lower():
            i += 1
            continue

        repeated = [current]
        j = i + 1
        while j < len(tokens) and tokens[j].group(0).lower() == current.group(0).lower():
            repeated.append(tokens[j])
            j += 1

        issues.append(
            DisfluencyIssue(
                type="repeat",
                text=" ".join(match.group(0) for match in repeated),
                count=len(repeated),
            )
        )
        score += rules.scoring.repetition_weight
        highlights.append(
            SegmentHighlight(
                type="repeat",
                text=text[repeated[0].start() : repeated[-1].end()],
                start_char=repeated[0].start(),
                end_char=repeated[-1].end(),
            )
        )
        i = j

    return issues, highlights, score


def _collect_self_repairs(
    text: str,
    rules: DisfluencyRulesConfig,
) -> tuple[list[DisfluencyIssue], list[SegmentHighlight], float]:
    issues: list[DisfluencyIssue] = []
    highlights: list[SegmentHighlight] = []
    score = 0.0

    for item in rules.self_repair_patterns:
        matches = list(re.finditer(item.pattern, text, flags=re.IGNORECASE))
        if not matches:
            continue
        issues.append(DisfluencyIssue(type="self_repair", text=item.label, count=len(matches)))
        score += rules.scoring.self_repair_weight * len(matches)
        for match in matches:
            highlights.append(
                SegmentHighlight(
                    type="self_repair",
                    text=match.group(0),
                    start_char=match.start(),
                    end_char=match.end(),
                )
            )

    return issues, highlights, score


def analyze_disfluency(
    state: AnalysisState,
    config_path: str | Path | None = None,
) -> AnalysisState:
    disfluency_provider = _resolve_disfluency_provider(state, config_path=config_path)
    runtime_language = _resolve_runtime_language(state)
    rules = load_disfluency_rules(config_path=config_path, language=runtime_language)
    outputs: list[DisfluencyOutput] = []

    for segment in state.segments:
        filler_issues, filler_highlights, filler_score = _collect_fillers(segment.text, rules)
        repeat_issues, repeat_highlights, repeat_score = _collect_repetitions(segment.text, rules)
        repair_issues, repair_highlights, repair_score = _collect_self_repairs(segment.text, rules)

        issues = filler_issues + repeat_issues + repair_issues
        highlights = filler_highlights + repeat_highlights + repair_highlights
        score = round(min(filler_score + repeat_score + repair_score, 1.0), 3)

        explanations: list[str] = []
        if filler_issues:
            explanations.append(rules.explanations.filler)
        if repeat_issues:
            explanations.append(rules.explanations.repeat)
        if repair_issues:
            explanations.append(rules.explanations.self_repair)

        segment.scores.disfluency = score
        segment.highlights.extend(highlights)

        outputs.append(
            DisfluencyOutput(
                segment_id=segment.segment_id,
                score=score,
                issues=issues,
                explanations=explanations,
            )
        )

    if disfluency_provider in {"llm", "hybrid"}:
        outputs = _apply_disfluency_llm_interpretation(state, outputs, config_path=config_path)

    state.agent_outputs.disfluency = outputs
    return state
