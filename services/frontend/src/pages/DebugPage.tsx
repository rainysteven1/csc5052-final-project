import { DebugControlBar, DebugLensPanel, RuntimeMetaCard } from "@/components/debug";
import { JsonViewer } from "@/components/shared/JsonViewer";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { useDebugPageState } from "@/hooks/useDebugPageState";
import { useAnalysisStore } from "@/store/analysis-store";

export function DebugPage() {
  const { activeView, handleViewChange } = useDebugPageState();
  const finalState = useAnalysisStore((state) => state.finalState);
  const activePayload = useAnalysisStore((state) => state.activePayload);
  const exportBaseName = finalState?.request_id || "speaksure-runtime";

  return (
    <div className="flex flex-col gap-5 pb-6">
      <DebugControlBar activeView={activeView} onChange={handleViewChange} />
      {activeView === "metadata" ? <DebugLensPanel /> : null}
      {activeView === "metadata" ? (
        <RuntimeMetaCard className="debug-surface" />
      ) : null}
      {activeView === "state" ? (
        <PageSectionCard
          eyebrow="State"
          title="State JSON"
          className="debug-surface"
          contentClassName="min-h-0 flex-1"
        >
          <JsonViewer value={finalState || {}} className="min-h-[560px]" exportName={`${exportBaseName}.state.json`} />
        </PageSectionCard>
      ) : null}
      {activeView === "event" ? (
        <PageSectionCard
          eyebrow="Event"
          title="Event JSON"
          className="debug-surface"
          contentClassName="min-h-0 flex-1"
        >
          <JsonViewer value={activePayload || {}} className="min-h-[560px]" exportName={`${exportBaseName}.event-payload.json`} />
        </PageSectionCard>
      ) : null}
    </div>
  );
}
