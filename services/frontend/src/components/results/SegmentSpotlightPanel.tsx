import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { ResultInfoBlock } from "@/components/results/ResultInfoBlock";
import { SegmentLinkedCoachingGrid } from "@/components/results/SegmentLinkedCoachingGrid";
import { ResultSectionCard } from "@/components/results/ResultSectionCard";
import { SpotlightHeader } from "@/components/results/SpotlightHeader";
import { asRecord, buildResultSummary, formatSeconds } from "@/lib/analysis-helpers";
import { useAnalysisStore } from "@/store/analysis-store";
import type { AnalysisStateResult } from "@/types/analysis";

type SegmentSpotlightPanelProps = {
  selectedId?: string | null;
  fallbackToFirst?: boolean;
};

export function SegmentSpotlightPanel({ selectedId = null, fallbackToFirst = true }: SegmentSpotlightPanelProps) {
  const finalState = useAnalysisStore((state) => state.finalState);
  const job = useAnalysisStore((state) => state.job);
  const summary = buildResultSummary(finalState, job);
  const selectedSegment = getSelectedSegment(summary.segmentResults, selectedId, fallbackToFirst);
  const feedbackRow =
    summary.feedbackRows.find((row) => String(row.segment_id || "") === selectedSegment?.segment_id) || null;
  const evidenceReadings = getSegmentEvidenceReadings(finalState, selectedSegment?.segment_id || null);
  const segmentSubtitle = selectedSegment
    ? `${formatSeconds(selectedSegment.start)} - ${formatSeconds(selectedSegment.end)} · ${selectedSegment.token_count || 0} tokens`
    : "";

  return (
    <PageSectionCard
      eyebrow="Segments"
      title="Segment spotlight"
      action={<Badge variant="outline">final {selectedSegment?.scores?.final?.toFixed(3) || "--"}</Badge>}
      contentClassName="space-y-4"
    >
      {!selectedSegment ? (
        <EmptyState title="No segment details" />
      ) : (
        <div className="space-y-4">
          <ResultSectionCard
            title={
              <SpotlightHeader
                title={selectedSegment.segment_id}
                subtitle={segmentSubtitle}
              />
            }
          >
            <ResultInfoBlock label="Transcript slice" value={selectedSegment.text || "--"} />

            <SegmentLinkedCoachingGrid
              problem={String(feedbackRow?.problem || feedbackRow?.reason || "No linked coaching note.")}
              rewrite={String(feedbackRow?.rewrite || "No linked rewrite.")}
              practice={String(feedbackRow?.practice || "No linked practice note.")}
            />
          </ResultSectionCard>

          <ResultSectionCard title="Evidence readings" bodyClassName="mt-0">
            <div className="grid gap-3 lg:grid-cols-3">
              {evidenceReadings.map((item) => (
                <ResultInfoBlock
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  tone="tone-secondary-muted"
                />
              ))}
            </div>
          </ResultSectionCard>
        </div>
      )}
    </PageSectionCard>
  );
}

function getSelectedSegment(
  segments: ReturnType<typeof buildResultSummary>["segmentResults"],
  selectedId: string | null,
  fallbackToFirst: boolean,
) {
  const matchedSegment = segments.find((segment) => segment.segment_id === selectedId) || null;
  return matchedSegment || (fallbackToFirst ? segments[0] || null : null);
}

function getSegmentEvidenceReadings(
  finalState: AnalysisStateResult | null,
  segmentId: string | null,
) {
  const agentOutputs =
    finalState && typeof finalState.agent_outputs === "object" && finalState.agent_outputs !== null
      ? finalState.agent_outputs
      : null;

  const lexical = findAgentOutputRow(agentOutputs?.lexical, segmentId);
  const prosody = findAgentOutputRow(agentOutputs?.prosody, segmentId);
  const disfluency = findAgentOutputRow(agentOutputs?.disfluency, segmentId);

  return [
    buildEvidenceReading("Lexical", lexical.interpretation, "No lexical interpretation."),
    buildEvidenceReading("Prosody", prosody.interpretation, "No prosody interpretation."),
    buildEvidenceReading(
      "Disfluency",
      disfluency.interpretation,
      "No disfluency interpretation.",
    ),
  ];
}

function buildEvidenceReading(
  label: string,
  value: unknown,
  fallback: string,
) {
  return {
    label,
    value: String(value || fallback),
  };
}

function findAgentOutputRow(
  rows: unknown,
  segmentId: string | null,
) {
  return (
    asRecord(
      (Array.isArray(rows) ? rows : []).find(
        (row) => String((row as Record<string, unknown>)?.segment_id || "") === segmentId,
      ),
    ) || {}
  );
}
