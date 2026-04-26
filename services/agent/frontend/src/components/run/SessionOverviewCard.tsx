import { AlertTriangle, RefreshCcw, RadioTower } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { prettifyNode, statusTone } from "@/lib/analysis-helpers";
import { useAnalysisStore } from "@/store/analysis-store";

export function SessionOverviewCard() {
  const mode = useAnalysisStore((state) => state.mode);
  const switchMode = useAnalysisStore((state) => state.switchMode);
  const job = useAnalysisStore((state) => state.job);
  const activeNode = useAnalysisStore((state) => state.activeNode);
  const error = useAnalysisStore((state) => state.error);

  return (
    <PageSectionCard
      eyebrow="Session"
      title="Session summary"
      description="This side stays stable while inputs change, so the layout does not jump around."
      className="h-full"
      contentClassName="flex min-h-0 flex-1 flex-col gap-5"
      action={
        <div className="flex gap-2">
          <Button variant={mode === "live" ? "default" : "secondary"} size="sm" onClick={() => switchMode("live")}>
            <RadioTower className="mr-2 h-4 w-4" />
            Live
          </Button>
          <Button variant={mode === "replay" ? "default" : "secondary"} size="sm" onClick={() => switchMode("replay")}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Replay
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <SummaryBox label="Current mode" value={mode === "live" ? "Live SSE session" : "Replay workspace"} />
        <SummaryBox label="Current node" value={prettifyNode(job?.current_node || activeNode)} />
      </div>

      {error ? (
        <div className="rounded-[24px] bg-destructive/10 px-4 py-4 text-sm text-destructive">
          <div className="mb-2 flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Runtime warning
          </div>
          {error}
        </div>
      ) : null}

      {job ? (
        <ScrollArea className="min-h-0 flex-1 pr-2">
          <div className="grid gap-4 pb-1">
            <div className="rounded-[28px] border bg-secondary/40 p-5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Session status</span>
                <Badge variant={statusTone(job.status) as "default"}>{job.status}</Badge>
              </div>
              <div className="mt-2 break-all font-medium text-foreground">{job.analysis_id}</div>
              <div className="mt-4 grid gap-2 text-muted-foreground">
                <div>Scenario: {job.scenario}</div>
                <div className="break-all">Audio: {job.audio_filename}</div>
                <div>
                  Steps: {job.completed_steps} / {job.total_steps}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <SummaryBox label="Summary" value={job.summary || "--"} large />
              <SummaryBox label="Dominant causes" value={job.dominant_causes.join(", ") || "--"} large />
            </div>
          </div>
        </ScrollArea>
      ) : null}
    </PageSectionCard>
  );
}

type SummaryBoxProps = {
  label: string;
  value: string;
  large?: boolean;
};

function SummaryBox({ label, value, large = false }: SummaryBoxProps) {
  return (
    <div className="rounded-[22px] border bg-background/70 p-4">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={large ? "content-scroll mt-2 max-h-36 pr-1 text-sm leading-6 text-foreground" : "mt-2 break-words text-sm font-medium text-foreground"}>{value}</div>
    </div>
  );
}
