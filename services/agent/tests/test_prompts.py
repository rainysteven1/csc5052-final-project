from __future__ import annotations

from pathlib import Path

from services.agent.src.backend.tools.prompt_loader import (
    load_prompt_template,
    prompt_debug_enabled,
    render_prompt_template,
    resolve_prompt_template_path,
)


def test_default_judgment_system_prompt_is_document_backed() -> None:
    path = resolve_prompt_template_path("judgment_system")

    assert path.name == "judgment_system.md"
    assert "# Role" in load_prompt_template("judgment_system")


def test_default_lexical_system_prompt_is_document_backed() -> None:
    path = resolve_prompt_template_path("lexical_system")

    assert path.name == "lexical_system.md"
    assert "# Role" in load_prompt_template("lexical_system")


def test_default_coaching_user_prompt_is_document_backed() -> None:
    path = resolve_prompt_template_path("coaching_user")

    assert path.name == "coaching_user.md"
    assert "{payload_json}" in load_prompt_template("coaching_user")


def test_default_feedback_repair_schema_is_document_backed() -> None:
    path = resolve_prompt_template_path("feedback_repair_schema")

    assert path.name == "feedback_segments_result.json"
    assert '"segments"' in load_prompt_template("feedback_repair_schema")


def test_default_lexical_repair_schema_is_document_backed() -> None:
    path = resolve_prompt_template_path("lexical_repair_schema")

    assert path.name == "lexical_result.json"
    assert '"interpretation"' in load_prompt_template("lexical_repair_schema")


def test_default_disfluency_repair_schema_is_document_backed() -> None:
    path = resolve_prompt_template_path("disfluency_repair_schema")

    assert path.name == "disfluency_result.json"
    assert '"feedback_focus"' in load_prompt_template("disfluency_repair_schema")


def test_default_prosody_repair_schema_is_document_backed() -> None:
    path = resolve_prompt_template_path("prosody_repair_schema")

    assert path.name == "prosody_result.json"
    assert '"coaching_hint"' in load_prompt_template("prosody_repair_schema")


def test_default_coaching_repair_schema_is_document_backed() -> None:
    path = resolve_prompt_template_path("coaching_repair_schema")

    assert path.name == "coaching_result.json"
    assert '"segments"' in load_prompt_template("coaching_repair_schema")


def test_judgment_prompt_path_uses_service_defaults_when_runtime_config_has_no_prompt_override(tmp_path: Path) -> None:
    defaults_path = resolve_prompt_template_path("judgment_system")
    config_path = tmp_path / "runtime.toml"
    config_path.write_text(
        """
[speaksure.contexts.interview.weights]
lexical = 0.6
prosody = 0.2
disfluency = 0.1
context = 0.1
""".strip(),
        encoding="utf-8",
    )

    resolved = resolve_prompt_template_path("judgment_system", config_path=config_path)
    loaded = load_prompt_template("judgment_system", config_path=config_path)

    assert resolved == defaults_path
    assert "# Role" in loaded


def test_render_prompt_template_uses_configured_markdown_file(tmp_path: Path) -> None:
    config_path = tmp_path / "runtime.toml"
    prompt_dir = tmp_path / "prompts"
    prompt_dir.mkdir()
    (prompt_dir / "feedback_system.md").write_text(
        '# Context\nScenario: {scenario}\nStyle: {style_constraints}\nSchema: {"segments": []}',
        encoding="utf-8",
    )
    config_path.write_text(
        """
[speaksure.prompts]
feedback_system = "prompts/feedback_system.md"
""".strip(),
        encoding="utf-8",
    )

    rendered = render_prompt_template(
        "feedback_system",
        variables={
            "scenario": "presentation",
            "style_constraints": "steady pacing and shorter pauses",
        },
        config_path=config_path,
    )

    assert "presentation" in rendered
    assert "steady pacing and shorter pauses" in rendered
    assert '{"segments": []}' in rendered


def test_render_prompt_template_supports_configured_lexical_prompt(tmp_path: Path) -> None:
    config_path = tmp_path / "runtime.toml"
    prompt_dir = tmp_path / "prompts"
    prompt_dir.mkdir()
    (prompt_dir / "lexical_user.md").write_text(
        "LEX::{scenario}::{payload_json}",
        encoding="utf-8",
    )
    config_path.write_text(
        """
[speaksure.prompts]
lexical_user = "prompts/lexical_user.md"
""".strip(),
        encoding="utf-8",
    )

    rendered = render_prompt_template(
        "lexical_user",
        variables={
            "scenario": "presentation",
            "payload_json": '{"segment_id":"seg_001"}',
        },
        config_path=config_path,
    )

    assert rendered == 'LEX::presentation::{"segment_id":"seg_001"}'


def test_prompt_loader_uses_language_override_when_available(tmp_path: Path) -> None:
    config_path = tmp_path / "runtime.toml"
    prompt_dir = tmp_path / "prompts"
    en_dir = prompt_dir / "en"
    prompt_dir.mkdir()
    en_dir.mkdir()
    (prompt_dir / "feedback_user.md").write_text("BASE::{payload_json}", encoding="utf-8")
    (en_dir / "feedback_user.md").write_text("EN::{payload_json}", encoding="utf-8")
    config_path.write_text(
        """
[speaksure.prompts]
feedback_user = "prompts/feedback_user.md"

[speaksure.prompts.language_overrides.en]
feedback_user = "prompts/en/feedback_user.md"
""".strip(),
        encoding="utf-8",
    )

    path = resolve_prompt_template_path("feedback_user", config_path=config_path, language="en")
    rendered = render_prompt_template(
        "feedback_user",
        variables={"payload_json": '{"segment_id":"seg_001"}'},
        config_path=config_path,
        language="en",
    )

    assert path == en_dir / "feedback_user.md"
    assert rendered == 'EN::{"segment_id":"seg_001"}'


def test_custom_repair_schema_path_can_be_configured(tmp_path: Path) -> None:
    config_path = tmp_path / "runtime.toml"
    prompt_dir = tmp_path / "schemas"
    prompt_dir.mkdir()
    (prompt_dir / "judgment_result.json").write_text(
        '{"summary":"ok","dominant_causes":["a"],"coaching_focus":["b"],"risk_segments":["seg_001"],"strengths":["s"]}',
        encoding="utf-8",
    )
    config_path.write_text(
        """
[speaksure.prompts]
judgment_repair_schema = "schemas/judgment_result.json"
""".strip(),
        encoding="utf-8",
    )

    loaded = load_prompt_template("judgment_repair_schema", config_path=config_path)

    assert '"summary":"ok"' in loaded


def test_prompt_debug_enabled_from_env(monkeypatch) -> None:
    monkeypatch.setenv("SPEAKSURE_DEBUG_PROMPTS", "1")

    assert prompt_debug_enabled() is True
