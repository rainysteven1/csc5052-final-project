import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { NodeSpotlight } from "@/components/pipeline/NodeSpotlight";
import { buildNodeDetails } from "@/lib/analysis-helpers";
import { useAnalysisStore } from "@/store/analysis-store";

export function NodeDetailPanel() {
  const activeNode = useAnalysisStore((state) => state.activeNode);
  const finalState = useAnalysisStore((state) => state.finalState);
  const activePayload = useAnalysisStore((state) => state.activePayload);
  const detail = buildNodeDetails(activeNode, finalState, activePayload);

  return (
    <PageSectionCard
      eyebrow="Spotlight"
      title={detail.title}
      description={detail.summary}
      className="h-full"
      contentClassName="flex min-h-0 flex-1 flex-col gap-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {detail.stats.length > 0 ? (
          detail.stats.map((item) => (
            <div key={item.label} className="rounded-[22px] border bg-background/70 p-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{item.label}</div>
              <div className="mt-2 font-display text-2xl">{item.value}</div>
            </div>
          ))
        ) : (
          <div className="sm:col-span-2">
            <EmptyState title="No stage stats" className="min-h-[120px]" />
          </div>
        )}
      </div>

      <div className="rounded-[24px] border bg-background/70 p-4">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Stage takeaways</div>
        <ScrollArea className="mt-3 max-h-[220px] pr-3">
          <div className="space-y-2 text-sm leading-6">
            {detail.bullets.length ? (
              detail.bullets.map((item) => (
                <div key={item} className="rounded-2xl bg-secondary/50 px-3 py-2">
                  {item}
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">--</div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="min-h-0 flex-1 rounded-[24px] border bg-background/70 p-4">
        <div className="mb-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Visual spotlight</div>
        <ScrollArea className="h-full pr-3">
          <NodeSpotlight node={activeNode} result={finalState} payload={activePayload} />
        </ScrollArea>
      </div>
    </PageSectionCard>
  );
}
