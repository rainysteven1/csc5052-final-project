import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { asStringArray, buildResultSummary } from "@/lib/analysis-helpers";
import { cn } from "@/lib/utils";
import { useAnalysisStore } from "@/store/analysis-store";

type FeedbackDeckProps = {
  selectedId?: string | null;
  onSelect?: (segmentId: string) => void;
};

export function FeedbackDeck({ selectedId = null, onSelect }: FeedbackDeckProps) {
  const finalState = useAnalysisStore((state) => state.finalState);
  const job = useAnalysisStore((state) => state.job);
  const summary = buildResultSummary(finalState, job);

  return (
    <PageSectionCard
      eyebrow="Coaching"
      title="Coaching feedback"
      description="Segment-specific problems, rewrites, and practice steps stay in one fixed-height feed."
      className="h-full"
      contentClassName="min-h-0 flex-1"
    >
      {summary.feedbackRows.length === 0 ? (
        <EmptyState title="No coaching cards" />
      ) : (
        <ScrollArea className="h-full pr-3">
          <div className="space-y-4">
            {summary.feedbackRows.map((row, index) => (
              <button
                key={`${String(row.segment_id)}-${index}`}
                type="button"
                onClick={() => {
                  const segmentId = String(row.segment_id || "");
                  if (segmentId && onSelect) {
                    onSelect(segmentId);
                  }
                }}
                className={cn(
                  "w-full rounded-[24px] border bg-background/70 p-4 text-left transition-all hover:bg-background/95",
                  selectedId && String(row.segment_id) === selectedId && "border-primary ring-2 ring-primary/20",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-medium">{String(row.segment_id || `segment-${index + 1}`)}</div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={row.severity === "high" ? "destructive" : row.severity === "stable" ? "accent" : "outline"}>
                      {String(row.severity || "unknown")}
                    </Badge>
                    {asStringArray(row.focus_tags).map((tag) => (
                      <Badge key={`${row.segment_id}-${tag}`} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <InfoBlock label="Problem" value={String(row.problem || row.reason || "n/a")} />
                  <InfoBlock label="Rewrite" value={String(row.rewrite || "n/a")} tone="bg-accent/10" />
                </div>

                <InfoBlock label="Practice" value={String(row.practice || "n/a")} className="mt-3" />

                <div className="mt-3 flex flex-wrap gap-2">
                  {asStringArray(row.practice_steps).map((item) => (
                    <Badge key={`${row.segment_id}-${item}`} variant="outline" className="bg-white/75">
                      {item}
                    </Badge>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </PageSectionCard>
  );
}

type InfoBlockProps = {
  label: string;
  value: string;
  tone?: string;
  className?: string;
};

function InfoBlock({ label, value, tone = "bg-secondary/45", className = "" }: InfoBlockProps) {
  return (
    <div className={`${className} rounded-[20px] ${tone} p-4`}>
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm leading-6">{value}</div>
    </div>
  );
}
