from __future__ import annotations

from pathlib import Path

from services.agent.src.state import AnalysisState, build_initial_state


def test_build_initial_state_resolves_audio_path(tmp_path: Path) -> None:
    audio_path = tmp_path / "demo.wav"
    audio_path.write_bytes(b"RIFFdemo")

    state = build_initial_state(audio_path=audio_path, scenario="interview")

    assert isinstance(state, AnalysisState)
    assert state.scenario == "interview"
    assert state.audio.source_path == str(audio_path.resolve())
    assert state.audio.format == "wav"
