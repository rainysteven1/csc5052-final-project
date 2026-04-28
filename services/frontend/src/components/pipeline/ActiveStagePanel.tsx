import { Progress } from "@/components/ui/progress";
import { PipelineInfoBlock } from "@/components/pipeline/PipelineInfoBlock";
import { PipelineSectionBlock } from "@/components/pipeline/PipelineSectionBlock";
import { prettifyNode } from "@/lib/analysis-helpers";
import { pipelineOrder } from "@/types/analysis";

type ActiveStagePanelProps = {
  activeNode: string;
  activeSubstep: string | null;
  progressPercent: number;
  completedSteps: number;
  totalSteps?: number;
  mode: "live" | "replay";
  eventsCount: number;
  replayCursor: number;
};

export function ActiveStagePanel({
  activeNode,
  activeSubstep,
  progressPercent,
  completedSteps,
  totalSteps,
  mode,
  eventsCount,
  replayCursor,
}: ActiveStagePanelProps) {
  return (
    <PipelineSectionBlock label="Active stage" bodyClassName="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-display text-xl font-semibold tracking-tight text-foreground">
          {prettifyNode(activeNode)}
          {activeSubstep ? <span className="text-base font-medium text-muted-foreground"> / {prettifyNode(activeSubstep)}</span> : null}
        </div>
        <PipelineInfoBlock
          label="Completion"
          value={`${Math.round(progressPercent)}%`}
          tone="glass-panel-soft"
          className="min-w-[132px]"
          valueClassName="font-display text-xl font-semibold leading-none"
        />
      </div>
      <div className="space-y-2">
        <Progress value={progressPercent} />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{completedSteps}/{totalSteps || pipelineOrder.length} stages finished</span>
          <span>{mode === "live" ? `${eventsCount} events` : `Frame ${eventsCount ? replayCursor + 1 : 0} / ${eventsCount}`}</span>
        </div>
      </div>
    </PipelineSectionBlock>
  );
}
