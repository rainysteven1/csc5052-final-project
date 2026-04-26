import type { ReactNode } from "react";

import { AlertTriangle, Gauge, Layers3, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { buildResultSummary } from "@/lib/analysis-helpers";
import { useAnalysisStore } from "@/store/analysis-store";

export function ResultsHero() {
  const finalState = useAnalysisStore((state) => state.finalState);
  const job = useAnalysisStore((state) => state.job);
  const summary = buildResultSummary(finalState, job);

  return (
    <PageSectionCard
      eyebrow="Report"
      title="Final output digest"
      description="The end-user coaching summary lives here, separated from runtime internals."
      className="h-full"
      contentClassName="flex min-h-0 flex-1 flex-col gap-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Score" value={summary.overallScore != null ? summary.overallScore.toFixed(3) : "--"} icon={<Gauge className="h-4 w-4" />} />
        <MetricCard label="Level" value={summary.level || "--"} icon={<Layers3 className="h-4 w-4" />} />
        <MetricCard label="Warnings" value={String(summary.warnings.length)} icon={<AlertTriangle className="h-4 w-4" />} />
        <MetricCard label="Errors" value={String(summary.errors.length)} icon={<ShieldAlert className="h-4 w-4" />} />
      </div>

      <div className="rounded-[28px] border bg-background/70 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Summary</div>
        <div className="content-scroll mt-3 max-h-[240px] pr-2 text-sm leading-7">{summary.summary}</div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[24px] border bg-background/70 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Dominant causes</div>
          <div className="content-scroll mt-4 flex max-h-[180px] flex-wrap gap-2 pr-1">
            {summary.dominantCauses.length ? (
              summary.dominantCauses.map((cause) => (
                <Badge key={cause} variant="outline" className="capitalize">
                  <Gauge className="mr-1 h-3 w-3" />
                  {cause}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">--</span>
            )}
          </div>
        </div>

        <div className="min-h-0 rounded-[24px] border bg-background/70 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Transcript snapshot</div>
          <ScrollArea className="mt-3 h-full min-h-[180px] pr-3">
            <div className="text-sm leading-7 text-foreground">{summary.transcript || "--"}</div>
          </ScrollArea>
        </div>
      </div>
    </PageSectionCard>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  icon: ReactNode;
};

function MetricCard({ label, value, icon }: MetricCardProps) {
  return (
    <div className="rounded-[24px] bg-secondary/45 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 font-display text-3xl">{value}</div>
    </div>
  );
}
