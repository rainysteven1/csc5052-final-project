import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { buildNodeVisuals, prettifyNode } from "@/lib/analysis-helpers";
import { cn } from "@/lib/utils";
import { useAnalysisStore } from "@/store/analysis-store";
import { pipelineIcons, pipelineOrder } from "@/types/analysis";

export function NodeGrid() {
  const finalState = useAnalysisStore((state) => state.finalState);
  const job = useAnalysisStore((state) => state.job);
  const activeNode = useAnalysisStore((state) => state.activeNode);
  const selectNode = useAnalysisStore((state) => state.selectNode);
  const nodeVisuals = buildNodeVisuals(finalState);

  return (
    <PageSectionCard
      eyebrow="Nodes"
      title="Node map"
      description="Each card is a dedicated pipeline stage with a compact, stable preview."
      className="h-full"
      contentClassName="min-h-0 flex-1"
    >
      {pipelineOrder.length === 0 ? (
        <EmptyState title="No nodes" />
      ) : (
        <ScrollArea className="h-full pr-2">
          <div className="grid min-h-full gap-3 pb-1 md:grid-cols-2 2xl:grid-cols-3">
          {pipelineOrder.map((node, index) => {
            const Icon = pipelineIcons[node];
            const isDone = (job?.completed_steps || 0) >= index + 1;
            const isActive = activeNode === node;
            const visual = nodeVisuals.find((item) => item.node === node);

            return (
              <button
                key={node}
                type="button"
                onClick={() => selectNode(node)}
                className={cn(
                  "relative min-h-[240px] rounded-[24px] border p-4 text-left transition-all",
                  "hover:-translate-y-0.5 hover:shadow-panel",
                  isActive && "border-primary ring-2 ring-primary/25",
                  isDone && !isActive && "border-accent/40",
                  !isDone && !isActive && "border-border/70",
                )}
              >
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-90", visual?.accent)} />
                <div className="relative flex min-h-[240px] flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className={cn("rounded-2xl p-2", isDone ? "bg-accent text-accent-foreground" : "bg-white/70")}>
                      <Icon className={cn("h-4 w-4", isActive && job?.status === "running" && "animate-spin")} />
                    </div>
                    <Badge variant={isDone ? "accent" : "outline"}>{index + 1}</Badge>
                  </div>
                  <div className="content-scroll flex-1 pr-1">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{visual?.eyebrow || "Pipeline node"}</div>
                    <div className="mt-2 break-words font-display text-lg">{visual?.title || prettifyNode(node)}</div>
                    <div className="mt-2 text-sm font-medium">{visual?.metric || "--"}</div>
                    <div className="mt-2 text-sm leading-6 text-muted-foreground">{visual?.detail || "--"}</div>
                  </div>
                </div>
              </button>
            );
          })}
          </div>
        </ScrollArea>
      )}
    </PageSectionCard>
  );
}
