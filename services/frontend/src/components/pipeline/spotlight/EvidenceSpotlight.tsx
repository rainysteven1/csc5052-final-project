import { EvidenceInsightsGrid } from "@/components/pipeline/spotlight/EvidenceInsightsGrid";
import { EvidenceOverviewGrid } from "@/components/pipeline/spotlight/EvidenceOverviewGrid";
import { EvidenceSegmentList } from "@/components/pipeline/spotlight/EvidenceSegmentList";
import { asRecord } from "@/lib/analysis-helpers";
import type { AnalysisStateResult, SegmentLike } from "@/types/analysis";

type EvidenceSpotlightProps = {
  snapshot: Record<string, unknown>;
  current: AnalysisStateResult;
  currentAgentOutputs: Record<string, unknown>;
};

export function EvidenceSpotlight({
  snapshot,
  current,
  currentAgentOutputs,
}: EvidenceSpotlightProps) {
  const lexical = toRecordArray(
    Array.isArray(snapshot.lexical) ? snapshot.lexical : currentAgentOutputs.lexical,
  );
  const prosody = toRecordArray(
    Array.isArray(snapshot.prosody) ? snapshot.prosody : currentAgentOutputs.prosody,
  );
  const disfluency = toRecordArray(
    Array.isArray(snapshot.disfluency) ? snapshot.disfluency : currentAgentOutputs.disfluency,
  );
  const context = asRecord(snapshot.context) || asRecord(currentAgentOutputs.context) || {};
  const evidenceSummary = asRecord(snapshot.evidence_summary) || asRecord(currentAgentOutputs.evidence_summary) || {};
  const segments = Array.isArray(snapshot.segments)
    ? (snapshot.segments as SegmentLike[])
    : Array.isArray(current?.segments)
      ? current.segments
      : [];
  const topLexical = Array.isArray(evidenceSummary.top_lexical_triggers) ? evidenceSummary.top_lexical_triggers : [];
  const riskSegments = Array.isArray(evidenceSummary.risk_segments) ? evidenceSummary.risk_segments : [];
  const scenario = typeof current?.scenario === "string" ? current.scenario : "presentation";

  const evidenceInsights = [
    ...lexical
      .filter((row) => row && (row.interpretation || row.rewrite_hint || row.practice_hint))
      .slice(0, 2)
      .map((row) => ({
        title: `${String(row.segment_id || "segment")} · lexical`,
        lines: [
          typeof row.interpretation === "string" ? row.interpretation : null,
          typeof row.rewrite_hint === "string" ? `Rewrite: ${row.rewrite_hint}` : null,
          typeof row.practice_hint === "string" ? `Drill: ${row.practice_hint}` : null,
        ].filter((item): item is string => Boolean(item)),
      })),
    ...prosody
      .filter((row) => row && (row.interpretation || row.coaching_hint || row.feedback_focus))
      .slice(0, 2)
      .map((row) => ({
        title: `${String(row.segment_id || "segment")} · prosody`,
        lines: [
          typeof row.interpretation === "string" ? row.interpretation : null,
          typeof row.coaching_hint === "string" ? `Drill: ${row.coaching_hint}` : null,
          typeof row.feedback_focus === "string" ? `Focus: ${row.feedback_focus}` : null,
        ].filter((item): item is string => Boolean(item)),
      })),
    ...disfluency
      .filter((row) => row && (row.interpretation || row.practice_hint || row.feedback_focus))
      .slice(0, 2)
      .map((row) => ({
        title: `${String(row.segment_id || "segment")} · disfluency`,
        lines: [
          typeof row.interpretation === "string" ? row.interpretation : null,
          typeof row.practice_hint === "string" ? `Drill: ${row.practice_hint}` : null,
          typeof row.feedback_focus === "string" ? `Focus: ${row.feedback_focus}` : null,
        ].filter((item): item is string => Boolean(item)),
      })),
  ].slice(0, 6);

  return (
    <div className="space-y-4">
      <EvidenceOverviewGrid
        lexical={lexical}
        prosody={prosody}
        disfluency={disfluency}
        context={context}
        evidenceSummary={evidenceSummary}
        scenario={scenario}
        topLexical={topLexical}
        riskSegments={riskSegments}
      />
      <EvidenceInsightsGrid insights={evidenceInsights} />
      <EvidenceSegmentList segments={segments} />
    </div>
  );
}

function toRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item));
}
