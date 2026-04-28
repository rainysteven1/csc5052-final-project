import { useEffect } from "react";

import { PipelineControlBar, PipelineWorkspace } from "@/components/pipeline";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { usePipelinePageState } from "@/hooks/usePipelinePageState";
import { useAnalysisStore } from "@/store/analysis-store";

export function PipelinePage() {
  const { activeView, handleViewChange } = usePipelinePageState();
  const pipelineScrollTarget = useAnalysisStore((state) => state.pipelineScrollTarget);
  const consumePipelineScrollTarget = useAnalysisStore((state) => state.consumePipelineScrollTarget);

  useEffect(() => {
    if (!pipelineScrollTarget) {
      return;
    }

    window.requestAnimationFrame(() => {
      const target = document.getElementById(pipelineScrollTarget);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      consumePipelineScrollTarget();
    });
  }, [consumePipelineScrollTarget, pipelineScrollTarget]);

  return (
    <div className="flex flex-col gap-5 pb-6">
      <PipelineControlBar activeView={activeView} onChange={handleViewChange} />

      <div>
        <ErrorBoundary
          title="Pipeline workspace unavailable"
          description="The node workspace hit a render error."
        >
          <PipelineWorkspace view={activeView} />
        </ErrorBoundary>
      </div>
    </div>
  );
}
