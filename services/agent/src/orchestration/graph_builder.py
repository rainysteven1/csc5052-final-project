"""LangGraph builder for the SpeakSure++ inference pipeline."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from langgraph.graph import END, START, StateGraph

from services.agent.src.orchestration.contracts import (
    BranchPayload,
    NodeFn,
    WorkflowExecutionError,
    WorkflowGraphState,
)
from services.agent.src.schemas.analysis import ContextOutput
from services.agent.src.services.agent.nodes.context_node import apply_context
from services.agent.src.services.agent.nodes.disfluency_node import analyze_disfluency
from services.agent.src.services.agent.nodes.feedback_node import apply_feedback
from services.agent.src.services.agent.nodes.lexical_node import analyze_lexical_uncertainty
from services.agent.src.services.agent.nodes.prosody_node import analyze_prosody
from services.agent.src.services.agent.nodes.reasoning_node import apply_reasoning
from services.agent.src.services.agent.nodes.segmentation_node import segment_transcript
from services.agent.src.services.artifact_loader import ArtifactBundle
from services.agent.src.services.audio_preprocess import preprocess_audio
from services.agent.src.state import AnalysisState
from services.asr.src.service import transcribe_audio


def _raise_workflow_error(step: str, state: AnalysisState, exc: Exception) -> WorkflowExecutionError:
    state.status = "failed"
    state.add_error(f"{step}: {exc}")
    state.result.status = "failed"
    return WorkflowExecutionError(step, state, exc)


def _wrap_state_node(step: str, node: NodeFn) -> Callable[[WorkflowGraphState], dict[str, AnalysisState]]:
    def runner(graph_state: WorkflowGraphState) -> dict[str, AnalysisState]:
        state = graph_state["base_state"]
        try:
            return {"base_state": node(state)}
        except WorkflowExecutionError:
            raise
        except Exception as exc:  # pragma: no cover - exercised via CLI failure handling
            raise _raise_workflow_error(step, state, exc) from exc

    return runner


def _wrap_branch_node(
    step: str,
    result_key: str,
    node: Callable[[AnalysisState], BranchPayload],
) -> Callable[[WorkflowGraphState], dict[str, BranchPayload]]:
    def runner(graph_state: WorkflowGraphState) -> dict[str, BranchPayload]:
        state = graph_state["base_state"]
        try:
            return {result_key: node(state)}
        except WorkflowExecutionError:
            raise
        except Exception as exc:  # pragma: no cover - exercised via CLI failure handling
            raise _raise_workflow_error(step, state, exc) from exc

    return runner


def prepare_input_node(state: AnalysisState) -> AnalysisState:
    return preprocess_audio(state)


def lexical_branch_node(state: AnalysisState) -> BranchPayload:
    branch_state = analyze_lexical_uncertainty(state.model_copy(deep=True))
    segment_updates: dict[str, dict[str, Any]] = {}
    for segment in branch_state.segments:
        segment_updates[segment.segment_id] = {
            "score": segment.scores.lexical,
            "highlights": [item.model_copy(deep=True) for item in segment.highlights],
        }
    return {
        "outputs": [item.model_copy(deep=True) for item in branch_state.agent_outputs.lexical],
        "segment_updates": segment_updates,
    }


def prosody_branch_node(state: AnalysisState) -> BranchPayload:
    branch_state = analyze_prosody(state.model_copy(deep=True))
    segment_updates: dict[str, dict[str, Any]] = {}
    for segment in branch_state.segments:
        segment_updates[segment.segment_id] = {"score": segment.scores.prosody}
    return {
        "outputs": [item.model_copy(deep=True) for item in branch_state.agent_outputs.prosody],
        "segment_updates": segment_updates,
    }


def disfluency_branch_node(state: AnalysisState) -> BranchPayload:
    branch_state = analyze_disfluency(state.model_copy(deep=True))
    segment_updates: dict[str, dict[str, Any]] = {}
    for segment in branch_state.segments:
        segment_updates[segment.segment_id] = {
            "score": segment.scores.disfluency,
            "highlights": [item.model_copy(deep=True) for item in segment.highlights],
        }
    return {
        "outputs": [item.model_copy(deep=True) for item in branch_state.agent_outputs.disfluency],
        "segment_updates": segment_updates,
    }


def context_branch_node(state: AnalysisState, *, config_path: str | None = None) -> BranchPayload:
    branch_state = apply_context(state.model_copy(deep=True), config_path=config_path)
    return {"output": branch_state.agent_outputs.context.model_copy(deep=True)}


def merge_analysis_node(graph_state: WorkflowGraphState) -> dict[str, AnalysisState]:
    state = graph_state["base_state"].model_copy(deep=True)
    lexical_result = graph_state.get("lexical_result", {})
    prosody_result = graph_state.get("prosody_result", {})
    disfluency_result = graph_state.get("disfluency_result", {})
    context_result = graph_state.get("context_result", {})

    segment_by_id = {segment.segment_id: segment for segment in state.segments}

    lexical_outputs = lexical_result.get("outputs", [])
    state.agent_outputs.lexical = [item.model_copy(deep=True) for item in lexical_outputs]
    for segment_id, update in lexical_result.get("segment_updates", {}).items():
        segment = segment_by_id.get(segment_id)
        if segment is None:
            continue
        segment.scores.lexical = float(update.get("score") or 0.0)
        segment.highlights = [item.model_copy(deep=True) for item in update.get("highlights", [])]

    prosody_outputs = prosody_result.get("outputs", [])
    state.agent_outputs.prosody = [item.model_copy(deep=True) for item in prosody_outputs]
    for segment_id, update in prosody_result.get("segment_updates", {}).items():
        segment = segment_by_id.get(segment_id)
        if segment is None:
            continue
        segment.scores.prosody = float(update.get("score") or 0.0)

    disfluency_outputs = disfluency_result.get("outputs", [])
    state.agent_outputs.disfluency = [item.model_copy(deep=True) for item in disfluency_outputs]
    for segment_id, update in disfluency_result.get("segment_updates", {}).items():
        segment = segment_by_id.get(segment_id)
        if segment is None:
            continue
        segment.scores.disfluency = float(update.get("score") or 0.0)
        segment.highlights.extend(item.model_copy(deep=True) for item in update.get("highlights", []))

    context_output = context_result.get("output")
    if isinstance(context_output, ContextOutput):
        state.agent_outputs.context = context_output.model_copy(deep=True)

    return {"base_state": state}


def reasoning_node(state: AnalysisState) -> AnalysisState:
    return apply_reasoning(state)


def feedback_node(state: AnalysisState) -> AnalysisState:
    return apply_feedback(state)


def serialize_result_node(state: AnalysisState) -> AnalysisState:
    state.status = "completed" if not state.errors else "failed"
    state.result.status = state.status
    state.result.segment_results = [segment.model_copy(deep=True) for segment in state.segments]
    return state


def build_inference_graph(
    artifacts: ArtifactBundle,
    *,
    config_path: str | None = None,
    transcript_override: str | None = None,
) -> tuple[list[str], Any]:
    def asr_step(state: AnalysisState) -> AnalysisState:
        return transcribe_audio(state, artifacts, transcript_override=transcript_override)

    def context_step(state: AnalysisState) -> BranchPayload:
        return context_branch_node(state, config_path=config_path)

    node_names = [
        "prepare_input",
        "asr",
        "segment",
        "lexical",
        "prosody",
        "disfluency",
        "context",
        "merge_analysis",
        "reasoning",
        "feedback",
        "serialize_result",
    ]

    graph_builder = StateGraph(WorkflowGraphState)
    graph_builder.add_node("prepare_input", _wrap_state_node("prepare_input", prepare_input_node))
    graph_builder.add_node("asr", _wrap_state_node("asr", asr_step))
    graph_builder.add_node("segment", _wrap_state_node("segment", segment_transcript))
    graph_builder.add_node("lexical", _wrap_branch_node("lexical", "lexical_result", lexical_branch_node))
    graph_builder.add_node("prosody", _wrap_branch_node("prosody", "prosody_result", prosody_branch_node))
    graph_builder.add_node(
        "disfluency",
        _wrap_branch_node("disfluency", "disfluency_result", disfluency_branch_node),
    )
    graph_builder.add_node("context", _wrap_branch_node("context", "context_result", context_step))
    graph_builder.add_node("merge_analysis", merge_analysis_node)
    graph_builder.add_node("reasoning", _wrap_state_node("reasoning", reasoning_node))
    graph_builder.add_node("feedback", _wrap_state_node("feedback", feedback_node))
    graph_builder.add_node("serialize_result", _wrap_state_node("serialize_result", serialize_result_node))

    graph_builder.add_edge(START, "prepare_input")
    graph_builder.add_edge("prepare_input", "asr")
    graph_builder.add_edge("asr", "segment")
    graph_builder.add_edge("segment", "lexical")
    graph_builder.add_edge("segment", "prosody")
    graph_builder.add_edge("segment", "disfluency")
    graph_builder.add_edge("segment", "context")
    graph_builder.add_edge(["lexical", "prosody", "disfluency", "context"], "merge_analysis")
    graph_builder.add_edge("merge_analysis", "reasoning")
    graph_builder.add_edge("reasoning", "feedback")
    graph_builder.add_edge("feedback", "serialize_result")
    graph_builder.add_edge("serialize_result", END)

    return node_names, graph_builder.compile()
