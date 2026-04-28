"""LangGraph builder for the SpeakSure++ inference pipeline."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel

from services.agent.src.orchestration.contracts import (
    BranchPayload,
    NodeFn,
    WorkflowProgressCallback,
    WorkflowExecutionError,
    WorkflowGraphState,
)
from services.agent.src.schemas.analysis import ContextOutput
from services.agent.src.backend.nodes.context_node import apply_context
from services.agent.src.backend.nodes.disfluency_node import analyze_disfluency
from services.agent.src.backend.nodes.coaching_node import apply_coaching
from services.agent.src.backend.nodes.lexical_node import analyze_lexical_uncertainty
from services.agent.src.backend.nodes.prosody_node import analyze_prosody
from services.agent.src.backend.nodes.segmentation_node import segment_transcript
from services.agent.src.asr.runtime import transcribe_audio
from services.agent.src.services.artifact_loader import ArtifactBundle
from services.agent.src.backend.tools.evidence_summary import build_evidence_summary
from services.agent.src.services.audio_preprocess import preprocess_audio
from services.agent.src.state import AnalysisState


def _jsonify(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return {str(key): _jsonify(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_jsonify(item) for item in value]
    if isinstance(value, tuple):
        return [_jsonify(item) for item in value]
    return value


def _emit_progress(
    progress_callback: WorkflowProgressCallback | None,
    *,
    event_type: str,
    step: str,
    step_index: int,
    total_steps: int,
    status: str,
    payload: dict[str, Any] | None = None,
) -> None:
    if progress_callback is None:
        return
    if event_type == "node_started" and total_steps:
        progress = max((step_index - 1) / total_steps, 0.0)
    elif total_steps:
        progress = step_index / total_steps
    else:
        progress = 0.0
    progress_callback(
        {
            "event_type": event_type,
            "node": step,
            "step_index": step_index,
            "total_steps": total_steps,
            "status": status,
            "progress": progress,
            "payload": payload or {},
        }
    )


def _build_state_snapshot(state: AnalysisState) -> dict[str, Any]:
    return state.model_dump(mode="json")


def _emit_substep_progress(
    progress_callback: WorkflowProgressCallback | None,
    *,
    phase: str,
    substep: str,
    step_index: int,
    total_steps: int,
    status: str,
    state: AnalysisState,
    event_type: str,
) -> None:
    _emit_progress(
        progress_callback,
        event_type=event_type,
        step=phase,
        step_index=step_index,
        total_steps=total_steps,
        status=status,
        payload={
            "substep": substep,
            "state": _build_state_snapshot(state),
        },
    )


def _raise_workflow_error(
    step: str,
    state: AnalysisState,
    exc: Exception,
    *,
    progress_callback: WorkflowProgressCallback | None = None,
    step_index: int = 0,
    total_steps: int = 0,
) -> WorkflowExecutionError:
    state.status = "failed"
    state.add_error(f"{step}: {exc}")
    state.result.status = "failed"
    _emit_progress(
        progress_callback,
        event_type="node_failed",
        step=step,
        step_index=step_index,
        total_steps=total_steps,
        status=state.status,
        payload={"error": str(exc), "state": _build_state_snapshot(state)},
    )
    return WorkflowExecutionError(step, state, exc)


def _wrap_state_node(
    step: str,
    node: NodeFn,
    *,
    step_index: int,
    total_steps: int,
    progress_callback: WorkflowProgressCallback | None = None,
) -> Callable[[WorkflowGraphState], dict[str, AnalysisState]]:
    def runner(graph_state: WorkflowGraphState) -> dict[str, AnalysisState]:
        state = graph_state["base_state"]
        _emit_progress(
            progress_callback,
            event_type="node_started",
            step=step,
            step_index=step_index,
            total_steps=total_steps,
            status=state.status,
            payload={"state": _build_state_snapshot(state)},
        )
        try:
            updated_state = node(state)
            _emit_progress(
                progress_callback,
                event_type="node_completed",
                step=step,
                step_index=step_index,
                total_steps=total_steps,
                status=updated_state.status,
                payload={"state": _build_state_snapshot(updated_state)},
            )
            return {"base_state": updated_state}
        except WorkflowExecutionError:
            raise
        except Exception as exc:  # pragma: no cover - exercised via CLI failure handling
            raise _raise_workflow_error(
                step,
                state,
                exc,
                progress_callback=progress_callback,
                step_index=step_index,
                total_steps=total_steps,
            ) from exc

    return runner


def _wrap_branch_node(
    step: str,
    result_key: str,
    node: Callable[[AnalysisState], BranchPayload],
    *,
    step_index: int,
    total_steps: int,
    progress_callback: WorkflowProgressCallback | None = None,
) -> Callable[[WorkflowGraphState], dict[str, BranchPayload]]:
    def runner(graph_state: WorkflowGraphState) -> dict[str, BranchPayload]:
        state = graph_state["base_state"]
        _emit_progress(
            progress_callback,
            event_type="node_started",
            step=step,
            step_index=step_index,
            total_steps=total_steps,
            status=state.status,
            payload={"state": _build_state_snapshot(state)},
        )
        try:
            payload = node(state)
            _emit_progress(
                progress_callback,
                event_type="node_completed",
                step=step,
                step_index=step_index,
                total_steps=total_steps,
                status=state.status,
                payload={"branch_result": _jsonify(payload)},
            )
            return {result_key: payload}
        except WorkflowExecutionError:
            raise
        except Exception as exc:  # pragma: no cover - exercised via CLI failure handling
            raise _raise_workflow_error(
                step,
                state,
                exc,
                progress_callback=progress_callback,
                step_index=step_index,
                total_steps=total_steps,
            ) from exc

    return runner


def prepare_input_node(state: AnalysisState) -> AnalysisState:
    return preprocess_audio(state)


def input_stage_node(
    state: AnalysisState,
    artifacts: ArtifactBundle,
    *,
    transcript_override: str | None = None,
    progress_callback: WorkflowProgressCallback | None = None,
    step_index: int = 0,
    total_steps: int = 0,
) -> AnalysisState:
    state.meta.setdefault("workflow_substeps", {})["input"] = ["prepare_input", "asr", "segment"]
    _emit_substep_progress(
        progress_callback,
        phase="input",
        substep="prepare_input",
        step_index=step_index,
        total_steps=total_steps,
        status=state.status,
        state=state,
        event_type="substep_started",
    )
    prepared = prepare_input_node(state)
    _emit_substep_progress(
        progress_callback,
        phase="input",
        substep="prepare_input",
        step_index=step_index,
        total_steps=total_steps,
        status=prepared.status,
        state=prepared,
        event_type="substep_completed",
    )
    _emit_substep_progress(
        progress_callback,
        phase="input",
        substep="asr",
        step_index=step_index,
        total_steps=total_steps,
        status=prepared.status,
        state=prepared,
        event_type="substep_started",
    )
    transcribed = transcribe_audio(prepared, artifacts, transcript_override=transcript_override)
    _emit_substep_progress(
        progress_callback,
        phase="input",
        substep="asr",
        step_index=step_index,
        total_steps=total_steps,
        status=transcribed.status,
        state=transcribed,
        event_type="substep_completed",
    )
    _emit_substep_progress(
        progress_callback,
        phase="input",
        substep="segment",
        step_index=step_index,
        total_steps=total_steps,
        status=transcribed.status,
        state=transcribed,
        event_type="substep_started",
    )
    segmented = segment_transcript(transcribed)
    _emit_substep_progress(
        progress_callback,
        phase="input",
        substep="segment",
        step_index=step_index,
        total_steps=total_steps,
        status=segmented.status,
        state=segmented,
        event_type="substep_completed",
    )
    return segmented


def lexical_branch_node(
    state: AnalysisState,
    *,
    config_path: str | None = None,
) -> BranchPayload:
    branch_state = analyze_lexical_uncertainty(state.model_copy(deep=True), config_path=config_path)
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


def prosody_branch_node(
    state: AnalysisState,
    *,
    config_path: str | None = None,
) -> BranchPayload:
    branch_state = analyze_prosody(state.model_copy(deep=True), config_path=config_path)
    segment_updates: dict[str, dict[str, Any]] = {}
    for segment in branch_state.segments:
        segment_updates[segment.segment_id] = {"score": segment.scores.prosody}
    return {
        "outputs": [item.model_copy(deep=True) for item in branch_state.agent_outputs.prosody],
        "segment_updates": segment_updates,
    }


def disfluency_branch_node(
    state: AnalysisState,
    *,
    config_path: str | None = None,
) -> BranchPayload:
    branch_state = analyze_disfluency(state.model_copy(deep=True), config_path=config_path)
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


def evidence_stage_node(
    state: AnalysisState,
    *,
    config_path: str | None = None,
    progress_callback: WorkflowProgressCallback | None = None,
    step_index: int = 0,
    total_steps: int = 0,
) -> AnalysisState:
    substeps = ["lexical", "prosody", "disfluency", "context", "merge_analysis"]
    state.meta.setdefault("workflow_substeps", {})["evidence"] = substeps

    current = state
    for substep, fn in (
        ("lexical", lambda s: analyze_lexical_uncertainty(s, config_path=config_path)),
        ("prosody", lambda s: analyze_prosody(s, config_path=config_path)),
        ("disfluency", lambda s: analyze_disfluency(s, config_path=config_path)),
        ("context", lambda s: apply_context(s, config_path=config_path)),
    ):
        _emit_substep_progress(
            progress_callback,
            phase="evidence",
            substep=substep,
            step_index=step_index,
            total_steps=total_steps,
            status=current.status,
            state=current,
            event_type="substep_started",
        )
        current = fn(current)
        _emit_substep_progress(
            progress_callback,
            phase="evidence",
            substep=substep,
            step_index=step_index,
            total_steps=total_steps,
            status=current.status,
            state=current,
            event_type="substep_completed",
        )

    _emit_substep_progress(
        progress_callback,
        phase="evidence",
        substep="merge_analysis",
        step_index=step_index,
        total_steps=total_steps,
        status=current.status,
        state=current,
        event_type="substep_started",
    )
    _emit_substep_progress(
        progress_callback,
        phase="evidence",
        substep="merge_analysis",
        step_index=step_index,
        total_steps=total_steps,
        status=current.status,
        state=current,
        event_type="substep_completed",
    )
    current.agent_outputs.evidence_summary = build_evidence_summary(current)
    return current


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


def _wrap_merge_node(
    *,
    step: str,
    step_index: int,
    total_steps: int,
    progress_callback: WorkflowProgressCallback | None = None,
) -> Callable[[WorkflowGraphState], dict[str, AnalysisState]]:
    def runner(graph_state: WorkflowGraphState) -> dict[str, AnalysisState]:
        state = graph_state["base_state"]
        _emit_progress(
            progress_callback,
            event_type="node_started",
            step=step,
            step_index=step_index,
            total_steps=total_steps,
            status=state.status,
            payload={"state": _build_state_snapshot(state)},
        )
        try:
            merged = merge_analysis_node(graph_state)
            merged_state = merged["base_state"]
            _emit_progress(
                progress_callback,
                event_type="node_completed",
                step=step,
                step_index=step_index,
                total_steps=total_steps,
                status=merged_state.status,
                payload={"state": _build_state_snapshot(merged_state)},
            )
            return merged
        except WorkflowExecutionError:
            raise
        except Exception as exc:  # pragma: no cover - exercised via CLI failure handling
            raise _raise_workflow_error(
                step,
                state,
                exc,
                progress_callback=progress_callback,
                step_index=step_index,
                total_steps=total_steps,
            ) from exc

    return runner


def coaching_stage_node(
    state: AnalysisState,
    *,
    config_path: str | None = None,
    progress_callback: WorkflowProgressCallback | None = None,
    step_index: int = 0,
    total_steps: int = 0,
) -> AnalysisState:
    state.meta.setdefault("workflow_substeps", {})["coaching"] = [
        "deterministic_fusion",
        "llm_coaching",
    ]
    _emit_substep_progress(
        progress_callback,
        phase="coaching",
        substep="deterministic_fusion",
        step_index=step_index,
        total_steps=total_steps,
        status=state.status,
        state=state,
        event_type="substep_started",
    )
    updated = coaching_overlay_node(state, config_path=config_path)
    _emit_substep_progress(
        progress_callback,
        phase="coaching",
        substep="deterministic_fusion",
        step_index=step_index,
        total_steps=total_steps,
        status=updated.status,
        state=updated,
        event_type="substep_completed",
    )
    _emit_substep_progress(
        progress_callback,
        phase="coaching",
        substep="llm_coaching",
        step_index=step_index,
        total_steps=total_steps,
        status=updated.status,
        state=updated,
        event_type="substep_started",
    )
    _emit_substep_progress(
        progress_callback,
        phase="coaching",
        substep="llm_coaching",
        step_index=step_index,
        total_steps=total_steps,
        status=updated.status,
        state=updated,
        event_type="substep_completed",
    )
    return updated


def coaching_overlay_node(
    state: AnalysisState,
    *,
    config_path: str | None = None,
) -> AnalysisState:
    return apply_coaching(state, config_path=config_path)


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
    progress_callback: WorkflowProgressCallback | None = None,
) -> tuple[list[str], Any]:
    def input_step(state: AnalysisState) -> AnalysisState:
        return input_stage_node(
            state,
            artifacts,
            transcript_override=transcript_override,
            progress_callback=progress_callback,
            step_index=step_index["input"],
            total_steps=total_steps,
        )

    def evidence_step(state: AnalysisState) -> AnalysisState:
        return evidence_stage_node(
            state,
            config_path=config_path,
            progress_callback=progress_callback,
            step_index=step_index["evidence"],
            total_steps=total_steps,
        )

    def coaching_step(state: AnalysisState) -> AnalysisState:
        return coaching_stage_node(
            state,
            config_path=config_path,
            progress_callback=progress_callback,
            step_index=step_index["coaching"],
            total_steps=total_steps,
        )

    node_names = [
        "input",
        "evidence",
        "coaching",
        "finalize",
    ]
    total_steps = len(node_names)
    step_index = {name: index + 1 for index, name in enumerate(node_names)}

    graph_builder = StateGraph(WorkflowGraphState)
    graph_builder.add_node(
        "input",
        _wrap_state_node(
            "input",
            input_step,
            step_index=step_index["input"],
            total_steps=total_steps,
            progress_callback=progress_callback,
        ),
    )
    graph_builder.add_node(
        "evidence",
        _wrap_state_node(
            "evidence",
            evidence_step,
            step_index=step_index["evidence"],
            total_steps=total_steps,
            progress_callback=progress_callback,
        ),
    )
    graph_builder.add_node(
        "coaching",
        _wrap_state_node(
            "coaching",
            coaching_step,
            step_index=step_index["coaching"],
            total_steps=total_steps,
            progress_callback=progress_callback,
        ),
    )
    graph_builder.add_node(
        "finalize",
        _wrap_state_node(
            "finalize",
            serialize_result_node,
            step_index=step_index["finalize"],
            total_steps=total_steps,
            progress_callback=progress_callback,
        ),
    )

    graph_builder.add_edge(START, "input")
    graph_builder.add_edge("input", "evidence")
    graph_builder.add_edge("evidence", "coaching")
    graph_builder.add_edge("coaching", "finalize")
    graph_builder.add_edge("finalize", END)

    return node_names, graph_builder.compile()
