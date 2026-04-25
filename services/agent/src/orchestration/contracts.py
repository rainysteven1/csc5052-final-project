"""Shared contracts for the SpeakSure++ workflow orchestration layer."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, TypedDict

from services.agent.src.state import AnalysisState

NodeFn = Callable[[AnalysisState], AnalysisState]
WorkflowProgressCallback = Callable[[dict[str, Any]], None]


class WorkflowExecutionError(RuntimeError):
    """Raised when a workflow step fails and the partial state should be preserved."""

    def __init__(self, step: str, state: AnalysisState, original: Exception):
        super().__init__(f"Workflow step '{step}' failed: {original}")
        self.step = step
        self.state = state
        self.original = original


class BranchPayload(TypedDict, total=False):
    outputs: list[Any]
    segment_updates: dict[str, dict[str, Any]]
    output: Any


class WorkflowGraphState(TypedDict, total=False):
    base_state: AnalysisState
    lexical_result: BranchPayload
    prosody_result: BranchPayload
    disfluency_result: BranchPayload
    context_result: BranchPayload
