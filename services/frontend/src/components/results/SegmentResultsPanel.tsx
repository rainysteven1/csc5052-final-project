import { EmptyState } from "@/components/shared/EmptyState";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { SegmentResultCard } from "@/components/results/SegmentResultCard";
import { Badge } from "@/components/ui/badge";
import { asRecord, buildResultSummary } from "@/lib/analysis-helpers";
import { useAnalysisStore } from "@/store/analysis-store";

type SegmentResultsPanelProps = {
  selectedId?: string | null;
  onSelect?: (segmentId: string) => void;
};

export function SegmentResultsPanel({ selectedId = null, onSelect }: SegmentResultsPanelProps) {
  const finalState = useAnalysisStore((state) => state.finalState);
  const job = useAnalysisStore((state) => state.job);
  const summary = buildResultSummary(finalState, job);
  const agentOutputs =
    finalState && typeof finalState.agent_outputs === "object" && finalState.agent_outputs !== null
      ? finalState.agent_outputs
      : null;
  const lexicalById = new Map((Array.isArray(agentOutputs?.lexical) ? agentOutputs.lexical : []).map((row) => [String(row.segment_id || ""), row]));
  const prosodyById = new Map((Array.isArray(agentOutputs?.prosody) ? agentOutputs.prosody : []).map((row) => [String(row.segment_id || ""), row]));
  const disfluencyById = new Map((Array.isArray(agentOutputs?.disfluency) ? agentOutputs.disfluency : []).map((row) => [String(row.segment_id || ""), row]));

  return (
    <PageSectionCard
      eyebrow="Diagnostics"
      title="Segment index"
      action={<Badge variant="outline">{summary.segmentResults.length} rows</Badge>}
      contentClassName="space-y-4"
    >
      {summary.segmentResults.length === 0 ? (
        <EmptyState title="No segment scores" />
      ) : (
        <div className="space-y-3">
          <div className="console-index-header sticky top-0 z-10 backdrop-blur">
            <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr_1.2fr] xl:items-center">
              <PanelHeaderCell label="Segment" />
              <PanelHeaderCell label="Weakest / evidence" />
              <PanelHeaderCell label="Scores" align="right" />
            </div>
          </div>

          {summary.segmentResults.map((segment) => {
            const lexical = asRecord(lexicalById.get(segment.segment_id)) || {};
            const prosody = asRecord(prosodyById.get(segment.segment_id)) || {};
            const disfluency = asRecord(disfluencyById.get(segment.segment_id)) || {};
            const drillRows = [
              lexical.interpretation ? ["Lexical", String(lexical.interpretation)] : null,
              prosody.interpretation ? ["Prosody", String(prosody.interpretation)] : null,
              disfluency.interpretation ? ["Disfluency", String(disfluency.interpretation)] : null,
            ].filter((item): item is [string, string] => item !== null);

            return (
              <SegmentResultCard
                key={segment.segment_id}
                segment={segment}
                drillRows={drillRows}
                selected={Boolean(selectedId && segment.segment_id === selectedId)}
                onSelect={onSelect}
              />
            );
          })}
        </div>
      )}
    </PageSectionCard>
  );
}

function PanelHeaderCell({
  label,
  align = "left",
}: {
  label: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={align === "right"
        ? "ui-label-xs text-right text-muted-foreground"
        : "ui-label-xs text-muted-foreground"}
    >
      {label}
    </div>
  );
}
