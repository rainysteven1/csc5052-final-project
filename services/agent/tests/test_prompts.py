from __future__ import annotations

from pathlib import Path

from services.agent.src.services.agent.tools.prompt_loader import (
    load_prompt_template,
    prompt_debug_enabled,
    render_prompt_template,
    resolve_prompt_template_path,
)


def test_default_reasoning_system_prompt_is_document_backed() -> None:
    path = resolve_prompt_template_path("reasoning_system")

    assert path.name == "reasoning_system.md"
    assert "# Role" in load_prompt_template("reasoning_system")


def test_default_feedback_repair_schema_is_document_backed() -> None:
    path = resolve_prompt_template_path("feedback_repair_schema")

    assert path.name == "feedback_segments_result.json"
    assert '"segments"' in load_prompt_template("feedback_repair_schema")


def test_render_prompt_template_uses_configured_markdown_file(tmp_path: Path) -> None:
    config_path = tmp_path / "runtime.toml"
    prompt_dir = tmp_path / "prompts"
    prompt_dir.mkdir()
    (prompt_dir / "feedback_system.md").write_text(
        "# Context\n场景: {scenario}\n风格: {style_constraints}\nSchema: {\"segments\": []}",
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
            "style_constraints": "保持节奏稳定、控制长停顿",
        },
        config_path=config_path,
    )

    assert "presentation" in rendered
    assert "保持节奏稳定、控制长停顿" in rendered
    assert '{"segments": []}' in rendered


def test_custom_repair_schema_path_can_be_configured(tmp_path: Path) -> None:
    config_path = tmp_path / "runtime.toml"
    prompt_dir = tmp_path / "schemas"
    prompt_dir.mkdir()
    (prompt_dir / "reasoning_result.json").write_text(
        '{"summary":"ok","dominant_causes":["a"],"coaching_focus":["b"]}',
        encoding="utf-8",
    )
    config_path.write_text(
        """
[speaksure.prompts]
reasoning_repair_schema = "schemas/reasoning_result.json"
""".strip(),
        encoding="utf-8",
    )

    loaded = load_prompt_template("reasoning_repair_schema", config_path=config_path)

    assert '"summary":"ok"' in loaded


def test_prompt_debug_enabled_from_env(monkeypatch) -> None:
    monkeypatch.setenv("SPEAKSURE_DEBUG_PROMPTS", "1")

    assert prompt_debug_enabled() is True
