"""State object for the SpeakSure++ inference runtime."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

from services.agent.src.schemas.analysis import (
    AgentOutputs,
    ArtifactMetadata,
    AudioMetadata,
    FinalAnalysisResult,
    SpeechSegment,
)


def _new_request_id() -> str:
    return f"req_{datetime.now(UTC).strftime('%Y%m%dT%H%M%S')}"


class AnalysisState(BaseModel):
    request_id: str = Field(default_factory=_new_request_id)
    status: Literal["pending", "running", "completed", "failed"] = "pending"
    scenario: str = "interview"
    audio: AudioMetadata = Field(default_factory=AudioMetadata)
    artifacts: ArtifactMetadata = Field(default_factory=ArtifactMetadata)
    transcript: str = ""
    raw_asr_segments: list[SpeechSegment] = Field(default_factory=list)
    segments: list[SpeechSegment] = Field(default_factory=list)
    agent_outputs: AgentOutputs = Field(default_factory=AgentOutputs)
    result: FinalAnalysisResult = Field(default_factory=FinalAnalysisResult)
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)

    def add_warning(self, message: str) -> None:
        if message not in self.warnings:
            self.warnings.append(message)

    def add_error(self, message: str) -> None:
        if message not in self.errors:
            self.errors.append(message)


def build_initial_state(audio_path: str | Path, scenario: str, request_id: str | None = None) -> AnalysisState:
    resolved = Path(audio_path).expanduser().resolve()
    return AnalysisState(
        request_id=request_id or _new_request_id(),
        scenario=scenario,
        audio=AudioMetadata(
            source_path=str(resolved),
            normalized_path="",
            format=resolved.suffix.lower().lstrip(".") or None,
            file_size_bytes=resolved.stat().st_size if resolved.exists() else None,
        ),
    )
