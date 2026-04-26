import { RuntimeMetaCard } from "@/components/debug/RuntimeMetaCard";
import { JsonViewer } from "@/components/shared/JsonViewer";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { useAnalysisStore } from "@/store/analysis-store";

export function DebugPage() {
  const finalState = useAnalysisStore((state) => state.finalState);
  const activePayload = useAnalysisStore((state) => state.activePayload);
  const exportBaseName = finalState?.request_id || "speaksure-runtime";

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 pb-3">
      <div className="min-h-0 flex-1">
        <div className="grid h-full min-h-0 gap-5 xl:grid-cols-[0.84fr_1.16fr]">
          <div className="min-h-0">
            <RuntimeMetaCard className="border-stone-300/70 bg-stone-50/88" />
          </div>
          <div className="grid min-h-0 gap-5 xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
            <PageSectionCard
              eyebrow="State"
              title="State JSON"
              className="h-full border-stone-300/70 bg-stone-50/88"
              contentClassName="min-h-0 flex-1"
            >
              <JsonViewer value={finalState || {}} className="h-full" exportName={`${exportBaseName}.state.json`} />
            </PageSectionCard>
            <PageSectionCard
              eyebrow="Event"
              title="Event JSON"
              className="h-full border-stone-300/70 bg-stone-50/88"
              contentClassName="min-h-0 flex-1"
            >
              <JsonViewer value={activePayload || {}} className="h-full" exportName={`${exportBaseName}.event-payload.json`} />
            </PageSectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
