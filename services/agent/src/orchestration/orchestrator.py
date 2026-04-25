"""Top-level workflow orchestrator for SpeakSure++ inference."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from services.agent.src.orchestration.contracts import WorkflowExecutionError, WorkflowProgressCallback
from services.agent.src.orchestration.graph_builder import build_inference_graph
from services.agent.src.services.artifact_loader import ArtifactBundle, load_artifacts
from services.agent.src.state import AnalysisState


@dataclass
class InferenceWorkflow:
    artifacts: ArtifactBundle
    node_names: list[str]
    graph: Any
    progress_callback: WorkflowProgressCallback | None = None

    def invoke(self, state_input: AnalysisState | dict[str, Any]) -> AnalysisState:
        state = state_input if isinstance(state_input, AnalysisState) else AnalysisState.model_validate(state_input)
        state.status = "running"
        state.artifacts = self.artifacts.metadata.model_copy(deep=True)
        state.meta["workflow_engine"] = "langgraph"
        state.meta["workflow_nodes"] = list(self.node_names)
        if self.progress_callback is not None:
            self.progress_callback(
                {
                    "event_type": "workflow_started",
                    "status": state.status,
                    "total_steps": len(self.node_names),
                    "payload": {
                        "request_id": state.request_id,
                        "scenario": state.scenario,
                        "audio": state.audio.model_dump(mode="json"),
                    },
                }
            )

        result = self.graph.invoke({"base_state": state})
        final_state = AnalysisState.model_validate(result["base_state"])
        if self.progress_callback is not None:
            self.progress_callback(
                {
                    "event_type": "workflow_finished",
                    "status": final_state.status,
                    "total_steps": len(self.node_names),
                    "payload": {
                        "warnings": list(final_state.warnings),
                        "errors": list(final_state.errors),
                        "result": final_state.result.model_dump(mode="json"),
                    },
                }
            )
        return final_state


def build_inference_workflow(
    artifacts: ArtifactBundle | None = None,
    *,
    config_path: str | None = None,
    transcript_override: str | None = None,
    progress_callback: WorkflowProgressCallback | None = None,
) -> InferenceWorkflow:
    resolved_artifacts = artifacts or load_artifacts(config_path)
    node_names, graph = build_inference_graph(
        resolved_artifacts,
        config_path=config_path,
        transcript_override=transcript_override,
        progress_callback=progress_callback,
    )
    return InferenceWorkflow(
        artifacts=resolved_artifacts,
        node_names=node_names,
        graph=graph,
        progress_callback=progress_callback,
    )


__all__ = ["InferenceWorkflow", "WorkflowExecutionError", "build_inference_workflow"]
