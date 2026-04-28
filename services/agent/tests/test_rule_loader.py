from __future__ import annotations

from pathlib import Path

from services.agent.src.backend.tools.rule_loader import (
    load_context_defaults,
    load_disfluency_rules,
    load_feedback_fallback_rules,
    load_lexical_rules,
    load_prosody_rules,
    load_scoring_rules,
    resolve_rule_config_path,
)


def test_rule_loader_uses_service_defaults_when_custom_config_has_no_rules(tmp_path: Path) -> None:
    defaults_path = resolve_rule_config_path("context_defaults")

    custom_config = tmp_path / "context_only.toml"
    custom_config.write_text(
        """
[speaksure.contexts.interview.weights]
lexical = 0.6
prosody = 0.2
disfluency = 0.1
context = 0.1

[speaksure.contexts.interview]
style_constraints = ["be direct"]
""".strip(),
        encoding="utf-8",
    )

    resolved = resolve_rule_config_path("context_defaults", config_path=custom_config)
    defaults = load_context_defaults(config_path=custom_config)

    assert resolved == defaults_path
    assert "presentation" in defaults.contexts
    assert defaults.fallback.style_constraints == ["使用默认场景配置"]


def test_rule_loader_reads_custom_rule_documents_relative_to_custom_config(tmp_path: Path) -> None:
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()

    (rules_dir / "lexical.toml").write_text(
        """
[[rules]]
phrase = "definitely"
weight = 0.41
explanation = "custom lexical rule"
""".strip(),
        encoding="utf-8",
    )
    (rules_dir / "disfluency.toml").write_text(
        """
[scoring]
filler_weight = 0.33
self_repair_weight = 0.44
repetition_weight = 0.55
repetition_token_pattern = "\\\\b[\\\\w']+\\\\b"

[explanations]
filler = "custom filler explanation"
repeat = "custom repeat explanation"
self_repair = "custom repair explanation"

[[filler_patterns]]
label = "erm"
pattern = "\\\\berm\\\\b"

[[self_repair_patterns]]
label = "wait"
pattern = "\\\\bwait\\\\b"
""".strip(),
        encoding="utf-8",
    )
    (rules_dir / "prosody.toml").write_text(
        """
[speech_rate]
slow_threshold = 3.0
slow_weight = 0.5
slow_cap = 0.6
slow_explanation = "custom slow"
fast_threshold = 5.0
fast_weight = 0.2
fast_cap = 0.3
fast_explanation = "custom fast"

[pause]
threshold = 0.2
weight = 0.4
cap = 0.5
explanation = "custom pause"

[energy]
flat_threshold = 0.2
min_duration = 0.1
penalty = 0.15
explanation = "custom energy"

[pitch]
flat_threshold = 0.2
min_duration = 0.1
penalty = 0.16
explanation = "custom pitch"
""".strip(),
        encoding="utf-8",
    )
    (rules_dir / "contexts.toml").write_text(
        """
[contexts.demo]
scenario = "demo"
style_constraints = ["custom context"]

[contexts.demo.weights]
lexical = 0.1
prosody = 0.2
disfluency = 0.3
context = 0.4

[fallback]
scenario = "default"
style_constraints = ["custom fallback"]

[fallback.weights]
lexical = 0.25
prosody = 0.25
disfluency = 0.25
context = 0.25
""".strip(),
        encoding="utf-8",
    )
    (rules_dir / "scoring.toml").write_text(
        """
[default_weights]
lexical = 0.6
prosody = 0.2
disfluency = 0.2

[level_thresholds]
high = 0.7
medium = 0.4
low_floor = 0.1

[dominant_causes]
lexical = "custom_lexical"
prosody = "custom_prosody"
disfluency = "custom_disfluency"

[summaries]
lexical_only = "custom lexical summary"
prosody_only = "custom prosody summary"
disfluency_only = "custom disfluency summary"
mixed = "custom mixed summary"
stable = "custom stable summary"
""".strip(),
        encoding="utf-8",
    )
    (rules_dir / "feedback.toml").write_text(
        """
[reasons]
lexical = "lexical::{triggers}"
prosody = "prosody reason"
disfluency = "disfluency::{issue_types}"
stable = "stable reason"

[practices]
lexical = "lexical practice"
prosody = "prosody practice"
disfluency = "disfluency practice"
stable = "stable practice"
stable_steps = ["stable one", "stable two"]

[join]
prefix = "BEGIN:"
delimiter = " | "
suffix = "!"
practice_delimiter = " + "

[focus_tags]
lexical = "lex_tag"
prosody = "pro_tag"
disfluency = "dis_tag"
""".strip(),
        encoding="utf-8",
    )

    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[speaksure.rules]
lexical_rules = "rules/lexical.toml"
disfluency_rules = "rules/disfluency.toml"
prosody_rules = "rules/prosody.toml"
context_defaults = "rules/contexts.toml"
scoring_rules = "rules/scoring.toml"
feedback_fallback_rules = "rules/feedback.toml"
""".strip(),
        encoding="utf-8",
    )

    lexical_rules = load_lexical_rules(config_path=config_path)
    disfluency_rules = load_disfluency_rules(config_path=config_path)
    prosody_rules = load_prosody_rules(config_path=config_path)
    context_defaults = load_context_defaults(config_path=config_path)
    scoring_rules = load_scoring_rules(config_path=config_path)
    feedback_rules = load_feedback_fallback_rules(config_path=config_path)

    assert lexical_rules[0].phrase == "definitely"
    assert lexical_rules[0].weight == 0.41
    assert disfluency_rules.filler_patterns[0].label == "erm"
    assert disfluency_rules.explanations.filler == "custom filler explanation"
    assert prosody_rules.pause.threshold == 0.2
    assert prosody_rules.pitch.penalty == 0.16
    assert context_defaults.contexts["demo"].style_constraints == ["custom context"]
    assert context_defaults.fallback.style_constraints == ["custom fallback"]
    assert scoring_rules.default_weights.lexical == 0.6
    assert scoring_rules.dominant_causes.lexical == "custom_lexical"
    assert feedback_rules.reasons.lexical == "lexical::{triggers}"


def test_rule_loader_uses_language_specific_override_when_available(tmp_path: Path) -> None:
    rules_dir = tmp_path / "rules"
    en_dir = rules_dir / "en"
    rules_dir.mkdir()
    en_dir.mkdir()

    (rules_dir / "lexical.toml").write_text(
        """
[[rules]]
phrase = "base"
weight = 0.11
explanation = "base rule"
""".strip(),
        encoding="utf-8",
    )
    (en_dir / "lexical.toml").write_text(
        """
[[rules]]
phrase = "definitely"
weight = 0.41
explanation = "english rule"
""".strip(),
        encoding="utf-8",
    )
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[speaksure.rules]
lexical_rules = "rules/lexical.toml"

[speaksure.rules.language_overrides.en]
lexical_rules = "rules/en/lexical.toml"
""".strip(),
        encoding="utf-8",
    )

    resolved = resolve_rule_config_path("lexical_rules", config_path=config_path, language="en")
    rules = load_lexical_rules(config_path=config_path, language="en")

    assert resolved == en_dir / "lexical.toml"
    assert rules[0].phrase == "definitely"
