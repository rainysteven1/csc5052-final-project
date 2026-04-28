import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { SelectionPill } from "@/components/shared/SelectionPill";
import { PipelineSelectableCard } from "@/components/pipeline/PipelineSelectableCard";
import { asRecord, buildNodeVisuals, getActiveSubstep, getWorkflowSubsteps, normalizeAnalysisState, prettifyNode } from "@/lib/analysis-helpers";
import { cn } from "@/lib/utils";
import { useAnalysisStore } from "@/store/analysis-store";
import type { AnalysisStateResult } from "@/types/analysis";
import { pipelineIcons, pipelineOrder } from "@/types/analysis";

export function NodeGrid() {
  const finalState = useAnalysisStore((state) => state.finalState);
  const job = useAnalysisStore((state) => state.job);
  const activeNode = useAnalysisStore((state) => state.activeNode);
  const activePayload = useAnalysisStore((state) => state.activePayload);
  const selectNode = useAnalysisStore((state) => state.selectNode);
  const stateFromPayload = normalizeAnalysisState(activePayload?.state) || finalState;
  const nodeVisuals = buildNodeVisuals(stateFromPayload);

  return (
    <PageSectionCard id="pipeline-node-map" eyebrow="Nodes" title="Node map">
      {pipelineOrder.length === 0 ? (
        <EmptyState title="No nodes" />
      ) : (
        <div className="grid gap-3 pb-1 md:grid-cols-2 2xl:grid-cols-3">
          {pipelineOrder.map((node, index) => {
            const isActive = activeNode === node;
            const visual = nodeVisuals.find((item) => item.node === node);
            const substeps = getWorkflowSubsteps(stateFromPayload, node);
            const activeSubstep = getActiveSubstep(isActive ? activePayload : null, node);

            return (
              <NodeGridCard
                key={node}
                node={node}
                index={index}
                visual={visual}
                substeps={substeps}
                activeSubstep={activeSubstep}
                onClick={() => selectNode(node)}
              />
            );
          })}
        </div>
      )}
    </PageSectionCard>
  );
}

type NodeGridCardProps = {
  node: (typeof pipelineOrder)[number];
  index: number;
  visual?: ReturnType<typeof buildNodeVisuals>[number];
  substeps: string[];
  activeSubstep: string | null;
  onClick: () => void;
};

function NodeGridCard({
  node,
  index,
  visual,
  substeps,
  activeSubstep,
  onClick,
}: NodeGridCardProps) {
  const Icon = pipelineIcons[node];

  return (
    <PipelineSelectableCard
      onClick={onClick}
      selected={false}
      className="relative min-h-[240px] overflow-hidden border-border/70 p-4"
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-90", visual?.accent)} />
      <div className="relative flex min-h-[240px] flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="rounded-2xl p-2 glass-chip-soft">
            <Icon className="h-4 w-4" />
          </div>
          <Badge variant="outline">{index + 1}</Badge>
        </div>
        <div className="content-scroll flex-1 pr-1">
          <div className="ui-label-sm text-muted-foreground">{visual?.eyebrow || "Pipeline node"}</div>
          <div className="mt-2 break-words font-display text-lg">{visual?.title || prettifyNode(node)}</div>
          <div className="mt-2 text-sm font-medium">{visual?.metric || "--"}</div>
          {visual?.detail ? (
            <div className="mt-2 text-sm leading-6 text-muted-foreground">{visual.detail}</div>
          ) : null}
          {substeps.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {substeps.map((substep) => (
                <SelectionPill
                  key={substep}
                  label={prettifyNode(substep)}
                  active={activeSubstep === substep}
                  className="px-2 py-1"
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </PipelineSelectableCard>
  );
}
