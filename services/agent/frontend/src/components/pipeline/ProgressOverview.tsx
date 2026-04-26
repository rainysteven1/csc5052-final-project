import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { prettifyNode, statusTone } from "@/lib/analysis-helpers";
import { pipelineOrder } from "@/types/analysis";
import { useAnalysisStore } from "@/store/analysis-store";
import { ReplayControls } from "@/components/pipeline/ReplayControls";

export function ProgressOverview() {
  const mode = useAnalysisStore((state) => state.mode);
  const job = useAnalysisStore((state) => state.job);
  const events = useAnalysisStore((state) => state.events);
  const activeNode = useAnalysisStore((state) => state.activeNode);

  const latest = events.length ? events[events.length - 1] : undefined;
  const progressPercent = latest?.progress != null
    ? latest.progress * 100
    : job?.total_steps
      ? (job.completed_steps / job.total_steps) * 100
      : 0;

  return (
    <PageSectionCard
      eyebrow="Runtime"
      title="Pipeline progress"
      description={`Active stage: ${prettifyNode(activeNode)}`}
      action={<Badge variant={statusTone(mode === "replay" ? "completed" : job?.status) as "default"}>{mode === "live" ? job?.status || "idle" : "replay"}</Badge>}
      className="h-full"
      contentClassName="flex min-h-0 flex-1 flex-col gap-4"
    >
      <div className="space-y-2">
        <Progress value={progressPercent} />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{Math.round(progressPercent)}% complete</span>
          <span>
            {job?.completed_steps || 0}/{job?.total_steps || pipelineOrder.length} nodes finished
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <QuickFact label="Mode" value={mode === "live" ? "Live stream" : "Replay"} />
        <QuickFact label="Analysis ID" value={job?.analysis_id || "--"} />
        <QuickFact label="Scenario" value={job?.scenario || "--"} />
        <QuickFact label="Audio" value={job?.audio_filename || "--"} />
      </div>

      <div className="min-h-0">
        <ReplayControls />
      </div>
    </PageSectionCard>
  );
}

type QuickFactProps = {
  label: string;
  value: string;
};

function QuickFact({ label, value }: QuickFactProps) {
  return (
    <div className="rounded-[22px] border bg-background/70 p-4">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="content-scroll mt-2 max-h-16 pr-1 text-sm font-medium break-words">{value}</div>
    </div>
  );
}
