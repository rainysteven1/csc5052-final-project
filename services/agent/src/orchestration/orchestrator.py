"""Top-level workflow orchestrator for SpeakSure++ inference."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from services.agent.src.orchestration.contracts import WorkflowExecutionError
from services.agent.src.orchestration.graph_builder import build_inference_graph
from services.agent.src.services.artifact_loader import ArtifactBundle, load_artifacts
from services.agent.src.state import AnalysisState


@dataclass
class InferenceWorkflow:
    artifacts: ArtifactBundle
    node_names: list[str]
    graph: Any

    def invoke(self, state_input: AnalysisState | dict[str, Any]) -> AnalysisState:
        state = state_input if isinstance(state_input, AnalysisState) else AnalysisState.model_validate(state_input)
        state.status = "running"
        state.artifacts = self.artifacts.metadata.model_copy(deep=True)
        state.meta["workflow_engine"] = "langgraph"
        state.meta["workflow_nodes"] = list(self.node_names)

        result = self.graph.invoke({"base_state": state})
        return AnalysisState.model_validate(result["base_state"])


def build_inference_workflow(
    artifacts: ArtifactBundle | None = None,
    *,
    config_path: str | None = None,
    transcript_override: str | None = None,
) -> InferenceWorkflow:
    resolved_artifacts = artifacts or load_artifacts(config_path)
    node_names, graph = build_inference_graph(
        resolved_artifacts,
        config_path=config_path,
        transcript_override=transcript_override,
    )
    return InferenceWorkflow(artifacts=resolved_artifacts, node_names=node_names, graph=graph)


__all__ = ["InferenceWorkflow", "WorkflowExecutionError", "build_inference_workflow"]
