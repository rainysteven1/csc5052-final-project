import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { NodeDetailPanel } from "@/components/pipeline/NodeDetailPanel";
import { NodeGrid } from "@/components/pipeline/NodeGrid";
import { ProgressOverview } from "@/components/pipeline/ProgressOverview";
import { TimelinePanel } from "@/components/pipeline/TimelinePanel";
import { useAnalysisStore } from "@/store/analysis-store";
import { pipelineOrder, type NodeName } from "@/types/analysis";

export function PipelinePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = useAnalysisStore((state) => state.mode);
  const events = useAnalysisStore((state) => state.events);
  const activeNode = useAnalysisStore((state) => state.activeNode);
  const replayCursor = useAnalysisStore((state) => state.replayCursor);
  const selectNode = useAnalysisStore((state) => state.selectNode);
  const setReplayCursor = useAnalysisStore((state) => state.setReplayCursor);

  useEffect(() => {
    const nodeParam = searchParams.get("node");
    if (!nodeParam || !pipelineOrder.includes(nodeParam as NodeName) || nodeParam === activeNode) {
      return;
    }
    selectNode(nodeParam as NodeName);
  }, [activeNode, searchParams, selectNode]);

  useEffect(() => {
    if (mode !== "replay") {
      return;
    }

    const frameParam = searchParams.get("frame");
    if (frameParam == null) {
      return;
    }

    const nextFrame = Number.parseInt(frameParam, 10);
    if (!Number.isFinite(nextFrame) || nextFrame < 0 || nextFrame >= events.length || nextFrame === replayCursor) {
      return;
    }

    setReplayCursor(nextFrame);
  }, [events.length, mode, replayCursor, searchParams, setReplayCursor]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    let changed = false;

    if (nextParams.get("node") !== activeNode) {
      nextParams.set("node", activeNode);
      changed = true;
    }

    if (mode === "replay" && events.length > 0) {
      const frameValue = String(replayCursor);
      if (nextParams.get("frame") !== frameValue) {
        nextParams.set("frame", frameValue);
        changed = true;
      }
    } else if (nextParams.has("frame")) {
      nextParams.delete("frame");
      changed = true;
    }

    if (changed) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeNode, events.length, mode, replayCursor, searchParams, setSearchParams]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 pb-3">
      <div className="shrink-0">
        <ProgressOverview />
      </div>

      <div className="min-h-0 flex-1">
        <div className="grid h-full min-h-0 gap-5 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="min-h-0">
            <NodeGrid />
          </div>
          <div className="grid min-h-0 gap-5 xl:grid-rows-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <div className="min-h-0">
              <NodeDetailPanel />
            </div>
            <div className="min-h-0">
              <TimelinePanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
