"""Load runtime rule configuration from documented files."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import tomllib
from pydantic import BaseModel, Field

from services.agent.src.config import default_config_path, load_config, repo_root
from services.agent.src.language import normalize_runtime_language
from services.agent.src.schemas.analysis import ContextOutput

DEFAULT_RULE_PATHS = {
    "lexical_rules": "rules/lexical_rules.toml",
    "disfluency_rules": "rules/disfluency_rules.toml",
    "prosody_rules": "rules/prosody_rules.toml",
    "context_defaults": "rules/context_defaults.toml",
    "scoring_rules": "rules/scoring_rules.toml",
    "feedback_fallback_rules": "rules/feedback_fallback_rules.toml",
}


class LexicalRuleConfig(BaseModel):
    phrase: str
    weight: float
    explanation: str


class PatternRuleConfig(BaseModel):
    label: str
    pattern: str


class DisfluencyScoringConfig(BaseModel):
    filler_weight: float = 0.12
    self_repair_weight: float = 0.16
    repetition_weight: float = 0.18
    repetition_token_pattern: str = r"\b[\w']+\b"


class DisfluencyExplanationConfig(BaseModel):
    filler: str = "该句包含填充词，影响语流干净程度。"
    repeat: str = "该句存在重复现象，影响表达流畅度。"
    self_repair: str = "该句包含自我修正痕迹，削弱了表达稳定性。"


class DisfluencyRulesConfig(BaseModel):
    filler_patterns: list[PatternRuleConfig] = Field(default_factory=list)
    self_repair_patterns: list[PatternRuleConfig] = Field(default_factory=list)
    scoring: DisfluencyScoringConfig = Field(default_factory=DisfluencyScoringConfig)
    explanations: DisfluencyExplanationConfig = Field(default_factory=DisfluencyExplanationConfig)


class SpeechRateRuleConfig(BaseModel):
    slow_threshold: float = 2.0
    slow_weight: float = 0.18
    slow_cap: float = 0.35
    slow_explanation: str = "语速偏慢，表达显得不够利落。"
    fast_threshold: float = 4.8
    fast_weight: float = 0.08
    fast_cap: float = 0.20
    fast_explanation: str = "语速偏快，语流稳定性可能下降。"


class PauseRuleConfig(BaseModel):
    threshold: float = 0.5
    weight: float = 0.25
    cap: float = 0.25
    explanation: str = "句前停顿偏长，影响表达连贯性。"


class FlatFeatureRuleConfig(BaseModel):
    flat_threshold: float
    min_duration: float
    penalty: float
    explanation: str


class ProsodyRulesConfig(BaseModel):
    speech_rate: SpeechRateRuleConfig = Field(default_factory=SpeechRateRuleConfig)
    pause: PauseRuleConfig = Field(default_factory=PauseRuleConfig)
    energy: FlatFeatureRuleConfig = Field(
        default_factory=lambda: FlatFeatureRuleConfig(
            flat_threshold=0.05,
            min_duration=0.5,
            penalty=0.12,
            explanation="能量变化较平，听感上略显平。",
        )
    )
    pitch: FlatFeatureRuleConfig = Field(
        default_factory=lambda: FlatFeatureRuleConfig(
            flat_threshold=0.01,
            min_duration=0.5,
            penalty=0.08,
            explanation="音高变化较少，表达起伏不足。",
        )
    )


class ContextDefaultsConfig(BaseModel):
    contexts: dict[str, ContextOutput] = Field(default_factory=dict)
    fallback: ContextOutput = Field(
        default_factory=lambda: ContextOutput(
            scenario="default",
            weights={"lexical": 0.25, "prosody": 0.25, "disfluency": 0.25, "context": 0.25},
            style_constraints=["使用默认场景配置"],
        )
    )


class ScoringWeightsConfig(BaseModel):
    lexical: float = 0.4
    prosody: float = 0.3
    disfluency: float = 0.3
    context: float = 0.0


class LevelThresholdsConfig(BaseModel):
    high: float = 0.65
    medium: float = 0.35
    low_floor: float = 0.0


class DominantCauseLabelsConfig(BaseModel):
    lexical: str = "lexical_uncertainty"
    prosody: str = "prosody"
    disfluency: str = "disfluency"


class SummaryTemplatesConfig(BaseModel):
    lexical_only: str = "检测到明显的措辞不确定性，部分句子使用了弱承诺或模糊表达。"
    prosody_only: str = "检测到明显的韵律问题，部分片段在语速、停顿或起伏上不够稳定。"
    disfluency_only: str = "检测到明显的流畅度问题，部分句子存在填充词、重复或自我修正。"
    mixed: str = "检测到多维度问题，部分片段在措辞、韵律或流畅度上都存在改进空间。"
    stable: str = "当前 lexical、prosody 和 disfluency 维度都未检测到明显问题。"


class ScoringRulesConfig(BaseModel):
    default_weights: ScoringWeightsConfig = Field(default_factory=ScoringWeightsConfig)
    level_thresholds: LevelThresholdsConfig = Field(default_factory=LevelThresholdsConfig)
    dominant_causes: DominantCauseLabelsConfig = Field(default_factory=DominantCauseLabelsConfig)
    summaries: SummaryTemplatesConfig = Field(default_factory=SummaryTemplatesConfig)


class FeedbackReasonConfig(BaseModel):
    lexical: str = "包含 {triggers} 等不确定性措辞"
    prosody: str = "语速、停顿或语调稳定性不足"
    disfluency: str = "存在 {issue_types} 等流畅度问题"
    stable: str = "该句在 lexical、prosody 和 disfluency 维度没有明显问题。"


class FeedbackPracticeConfig(BaseModel):
    lexical: str = "去掉模糊词后重复朗读 3 次，保持句首直接进入核心观点"
    prosody: str = "按短句切分朗读，控制句前停顿，并保持每句语速稳定"
    disfluency: str = "先放慢语速朗读一遍，再用无填充词版本重复 3 次"
    stable: str = "保持当前直接表达方式，继续检查语速和停顿即可。"
    stable_steps: list[str] = Field(
        default_factory=lambda: ["保持当前直接表达方式", "继续检查语速和停顿即可"]
    )


class FeedbackJoinConfig(BaseModel):
    prefix: str = "该句"
    delimiter: str = "，且"
    suffix: str = "。"
    practice_delimiter: str = "；"


class FeedbackTagsConfig(BaseModel):
    lexical: str = "lexical"
    prosody: str = "prosody"
    disfluency: str = "disfluency"


class FeedbackFallbackRulesConfig(BaseModel):
    reasons: FeedbackReasonConfig = Field(default_factory=FeedbackReasonConfig)
    practices: FeedbackPracticeConfig = Field(default_factory=FeedbackPracticeConfig)
    join: FeedbackJoinConfig = Field(default_factory=FeedbackJoinConfig)
    focus_tags: FeedbackTagsConfig = Field(default_factory=FeedbackTagsConfig)


def _read_rule_sections(config_path: str | Path | None = None) -> tuple[dict[str, str], dict[str, dict[str, str]]]:
    cfg = load_config(config_path)
    rules = cfg.speaksure.get("rules", {})
    if not isinstance(rules, dict):
        return {}, {}
    base_paths = {
        str(key): str(value)
        for key, value in rules.items()
        if isinstance(value, str)
    }
    language_overrides_raw = rules.get("language_overrides", {})
    language_overrides: dict[str, dict[str, str]] = {}
    if isinstance(language_overrides_raw, dict):
        for language, values in language_overrides_raw.items():
            if not isinstance(values, dict):
                continue
            normalized_language = normalize_runtime_language(language)
            if normalized_language is None:
                continue
            language_overrides[normalized_language] = {
                str(key): str(value)
                for key, value in values.items()
                if isinstance(value, str)
            }
    return base_paths, language_overrides


def _resolve_relative_path(raw_path: str, *, config_path: str | Path | None = None) -> Path:
    candidate = Path(raw_path)
    if candidate.is_absolute():
        return candidate.resolve()

    config_file = default_config_path() if config_path is None else Path(config_path).resolve()
    config_relative = (config_file.parent / candidate).resolve()
    if config_relative.exists():
        return config_relative

    repo_relative = (repo_root() / candidate).resolve()
    if repo_relative.exists():
        return repo_relative

    return config_relative


def resolve_rule_config_path(
    rule_name: str,
    *,
    config_path: str | Path | None = None,
    language: str | None = None,
) -> Path:
    if rule_name not in DEFAULT_RULE_PATHS:
        raise KeyError(f"Unknown rule config: {rule_name}")

    configured_paths, language_overrides = _read_rule_sections(config_path)
    normalized_language = normalize_runtime_language(language)
    if normalized_language is not None:
        raw_path = language_overrides.get(normalized_language, {}).get(rule_name)
        if raw_path is not None:
            return _resolve_relative_path(raw_path, config_path=config_path)

    raw_path = configured_paths.get(rule_name)
    if raw_path is not None:
        return _resolve_relative_path(raw_path, config_path=config_path)

    # Default rule files live beside the service config, not beside arbitrary
    # ad-hoc config files that may override only one section such as contexts.
    return _resolve_relative_path(DEFAULT_RULE_PATHS[rule_name], config_path=default_config_path())


def load_rule_document(
    rule_name: str,
    *,
    config_path: str | Path | None = None,
    language: str | None = None,
) -> dict[str, Any]:
    path = resolve_rule_config_path(rule_name, config_path=config_path, language=language)
    suffix = path.suffix.lower()

    if suffix == ".toml":
        with path.open("rb") as handle:
            return tomllib.load(handle)
    if suffix == ".json":
        return json.loads(path.read_text(encoding="utf-8"))

    raise ValueError(f"Unsupported rule config format for {rule_name}: {path}")


def load_lexical_rules(
    config_path: str | Path | None = None,
    *,
    language: str | None = None,
) -> list[LexicalRuleConfig]:
    payload = load_rule_document("lexical_rules", config_path=config_path, language=language)
    raw_rules = payload.get("rules", [])
    if not isinstance(raw_rules, list):
        return []
    return [LexicalRuleConfig.model_validate(item) for item in raw_rules]


def load_disfluency_rules(
    config_path: str | Path | None = None,
    *,
    language: str | None = None,
) -> DisfluencyRulesConfig:
    payload = load_rule_document("disfluency_rules", config_path=config_path, language=language)
    return DisfluencyRulesConfig.model_validate(payload)


def load_prosody_rules(
    config_path: str | Path | None = None,
    *,
    language: str | None = None,
) -> ProsodyRulesConfig:
    payload = load_rule_document("prosody_rules", config_path=config_path, language=language)
    return ProsodyRulesConfig.model_validate(payload)


def load_context_defaults(
    config_path: str | Path | None = None,
    *,
    language: str | None = None,
) -> ContextDefaultsConfig:
    payload = load_rule_document("context_defaults", config_path=config_path, language=language)
    return ContextDefaultsConfig.model_validate(payload)


def load_scoring_rules(
    config_path: str | Path | None = None,
    *,
    language: str | None = None,
) -> ScoringRulesConfig:
    payload = load_rule_document("scoring_rules", config_path=config_path, language=language)
    return ScoringRulesConfig.model_validate(payload)


def load_feedback_fallback_rules(
    config_path: str | Path | None = None,
    *,
    language: str | None = None,
) -> FeedbackFallbackRulesConfig:
    payload = load_rule_document("feedback_fallback_rules", config_path=config_path, language=language)
    return FeedbackFallbackRulesConfig.model_validate(payload)
