import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { MetricBar } from "@/components/pipeline/MetricBar";
import { buildResultSummary, formatSeconds } from "@/lib/analysis-helpers";
import { cn } from "@/lib/utils";
import { useAnalysisStore } from "@/store/analysis-store";

type SegmentResultsPanelProps = {
  selectedId?: string | null;
  onSelect?: (segmentId: string) => void;
};

export function SegmentResultsPanel({ selectedId = null, onSelect }: SegmentResultsPanelProps) {
  const finalState = useAnalysisStore((state) => state.finalState);
  const job = useAnalysisStore((state) => state.job);
  const summary = buildResultSummary(finalState, job);

  return (
    <PageSectionCard
      eyebrow="Diagnostics"
      title="Segment score sheet"
      description="A stable scrolling list of segment-level scores and final feedback links."
      className="h-full"
      contentClassName="min-h-0 flex-1"
    >
      {summary.segmentResults.length === 0 ? (
        <EmptyState title="No segment scores" />
      ) : (
        <ScrollArea className="h-full pr-3">
          <div className="space-y-3">
            {summary.segmentResults.map((segment) => (
              <button
                key={segment.segment_id}
                type="button"
                onClick={() => onSelect?.(segment.segment_id)}
                className={cn(
                  "w-full rounded-[24px] border bg-background/70 p-4 text-left transition-all hover:bg-background/95",
                  selectedId && segment.segment_id === selectedId && "border-primary ring-2 ring-primary/20",
                )}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-medium">{segment.segment_id}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatSeconds(segment.start)} - {formatSeconds(segment.end)} · {segment.token_count || 0} tokens
                    </div>
                  </div>
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">final {segment.scores?.final?.toFixed(3) || "--"}</div>
                </div>
                <div className="mt-3 text-sm leading-6">{segment.text || "--"}</div>
                <div className="mt-4 grid gap-3 lg:grid-cols-4">
                  <MetricBar label="Lexical" value={segment.scores?.lexical} tone="from-rose-400 to-orange-300" />
                  <MetricBar label="Prosody" value={segment.scores?.prosody} tone="from-cyan-400 to-emerald-300" />
                  <MetricBar label="Disfluency" value={segment.scores?.disfluency} tone="from-red-400 to-rose-300" />
                  <MetricBar label="Final" value={segment.scores?.final} tone="from-indigo-400 to-slate-300" />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </PageSectionCard>
  );
}
