import { EmptyState } from "@/components/shared/EmptyState";
import { FeedbackDeckCard } from "@/components/results/FeedbackDeckCard";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { Badge } from "@/components/ui/badge";
import { asRecord, asStringArray, buildResultSummary } from "@/lib/analysis-helpers";
import { useAnalysisStore } from "@/store/analysis-store";

type FeedbackDeckProps = {
  selectedId?: string | null;
  onSelect?: (segmentId: string) => void;
};

export function FeedbackDeck({ selectedId = null, onSelect }: FeedbackDeckProps) {
  const finalState = useAnalysisStore((state) => state.finalState);
  const job = useAnalysisStore((state) => state.job);
  const summary = buildResultSummary(finalState, job);
  const agentOutputs =
    finalState && typeof finalState.agent_outputs === "object" && finalState.agent_outputs !== null
      ? finalState.agent_outputs
      : null;
  const lexicalRows = Array.isArray(agentOutputs?.lexical) ? agentOutputs.lexical : [];
  const prosodyRows = Array.isArray(agentOutputs?.prosody) ? agentOutputs.prosody : [];
  const disfluencyRows = Array.isArray(agentOutputs?.disfluency) ? agentOutputs.disfluency : [];
  const lexicalById = new Map(lexicalRows.map((row) => [String(row.segment_id || ""), row]));
  const prosodyById = new Map(prosodyRows.map((row) => [String(row.segment_id || ""), row]));
  const disfluencyById = new Map(disfluencyRows.map((row) => [String(row.segment_id || ""), row]));

  return (
    <PageSectionCard
      eyebrow="Coaching"
      title="Coaching queue"
      action={<Badge variant="outline">{summary.feedbackRows.length} cards</Badge>}
      contentClassName="space-y-4"
    >
      {summary.feedbackRows.length === 0 ? (
        <EmptyState title="No coaching cards" />
      ) : (
        <div className="space-y-3">
          <div className="console-index-header sticky top-0 z-10 backdrop-blur">
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.25fr_0.9fr_0.7fr] xl:items-center">
              <HeaderCell label="Segment" />
              <HeaderCell label="Practice cue" />
              <HeaderCell label="Evidence channels" />
              <HeaderCell label="Counts" align="right" />
            </div>
          </div>

          {summary.feedbackRows.map((row, index) => {
            const segmentId = String(row.segment_id || "");
            const lexical = asRecord(lexicalById.get(segmentId)) || {};
            const prosody = asRecord(prosodyById.get(segmentId)) || {};
            const disfluency = asRecord(disfluencyById.get(segmentId)) || {};
            const focusTags = asStringArray(row.focus_tags);
            const practiceSteps = asStringArray(row.practice_steps);
            const evidenceSources = [
              lexical.interpretation || lexical.rewrite_hint ? "Lexical" : null,
              prosody.interpretation || prosody.coaching_hint ? "Prosody" : null,
              disfluency.interpretation || disfluency.practice_hint ? "Disfluency" : null,
            ].filter((item): item is string => item !== null);

            return (
              <FeedbackDeckCard
                key={`${segmentId}-${index}`}
                segmentId={String(row.segment_id || `segment-${index + 1}`)}
                severity={typeof row.severity === "string" ? row.severity : null}
                focusTags={focusTags}
                practice={String(row.practice || "n/a")}
                practiceSteps={practiceSteps}
                evidenceSources={evidenceSources}
                selected={Boolean(selectedId && String(row.segment_id) === selectedId)}
                onSelect={onSelect}
              />
            );
          })}
        </div>
      )}
    </PageSectionCard>
  );
}

function HeaderCell({
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
