import { CoachingBlockSection } from "@/components/results/CoachingBlockSection";
import { CoachingSummarySection } from "@/components/results/CoachingSummarySection";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { asRecord, asStringArray, buildResultSummary } from "@/lib/analysis-helpers";
import { useAnalysisStore } from "@/store/analysis-store";

export function CoachingDrilldownPanel() {
  const finalState = useAnalysisStore((state) => state.finalState);
  const job = useAnalysisStore((state) => state.job);
  const summary = buildResultSummary(finalState, job);
  const agentOutputs =
    finalState && typeof finalState.agent_outputs === "object" && finalState.agent_outputs !== null
      ? finalState.agent_outputs
      : null;
  const judgment = asRecord(agentOutputs?.judgment) || {};

  const blocks = [
    {
      title: "Coaching focus",
      rows: summary.coachingFocus,
      badge: `${summary.coachingFocus.length} items`,
    },
    {
      title: "Strengths to preserve",
      rows: summary.strengths,
      badge: `${summary.strengths.length} items`,
    },
    {
      title: "Risk segments",
      rows: asStringArray(judgment.risk_segments),
      badge: `${asStringArray(judgment.risk_segments).length} items`,
    },
  ];

  return (
    <PageSectionCard eyebrow="Coaching" title="Coaching drill-down">
      {!summary.summary || summary.summary === "--" ? (
        <EmptyState title="No coaching synthesis yet" />
      ) : (
        <div className="space-y-4">
          <CoachingSummarySection summary={summary} />

          {blocks.map((block) => (
            <CoachingBlockSection
              key={block.title}
              title={block.title}
              rows={block.rows}
              badge={block.badge}
            />
          ))}
        </div>
      )}
    </PageSectionCard>
  );
}
