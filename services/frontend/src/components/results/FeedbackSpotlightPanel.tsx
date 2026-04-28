import { EmptyState } from "@/components/shared/EmptyState";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { ResultChipList } from "@/components/results/ResultChipList";
import { ResultInfoBlock } from "@/components/results/ResultInfoBlock";
import { ResultSectionCard } from "@/components/results/ResultSectionCard";
import { SpotlightHeader } from "@/components/results/SpotlightHeader";
import { asStringArray, buildResultSummary } from "@/lib/analysis-helpers";
import { useAnalysisStore } from "@/store/analysis-store";

type FeedbackSpotlightPanelProps = {
  selectedId?: string | null;
  fallbackToFirst?: boolean;
};

export function FeedbackSpotlightPanel({ selectedId = null, fallbackToFirst = true }: FeedbackSpotlightPanelProps) {
  const finalState = useAnalysisStore((state) => state.finalState);
  const job = useAnalysisStore((state) => state.job);
  const summary = buildResultSummary(finalState, job);
  const selectedRow = getSelectedFeedbackRow(summary.feedbackRows, selectedId, fallbackToFirst);
  const emptyTitle = !fallbackToFirst && selectedId ? "No linked coaching card" : "No coaching feedback";
  const focusTags = selectedRow ? asStringArray(selectedRow.focus_tags) : [];
  const practiceSteps = selectedRow ? asStringArray(selectedRow.practice_steps) : [];
  const detailBlocks = buildFeedbackDetailBlocks(focusTags, practiceSteps);

  return (
    <PageSectionCard
      eyebrow="Feedback"
      title="Selected coaching card"
      action={<SeverityBadge severity={typeof selectedRow?.severity === "string" ? selectedRow.severity : null} />}
      contentClassName="space-y-4"
    >
      {!selectedRow ? (
        <EmptyState title={emptyTitle} />
      ) : (
        <div className="space-y-4">
          <ResultSectionCard
            title={
              <SpotlightHeader
                title={String(selectedRow.segment_id || "segment")}
                subtitle={`${focusTags.length} focus tags · ${practiceSteps.length} practice steps`}
              />
            }
          >
            <div className="grid gap-3 lg:grid-cols-2">
              <ResultInfoBlock label="Problem" value={String(selectedRow.problem || selectedRow.reason || "n/a")} />
              <ResultInfoBlock label="Rewrite" value={String(selectedRow.rewrite || "n/a")} tone="tone-accent-soft" />
            </div>

            <ResultInfoBlock label="Practice" value={String(selectedRow.practice || "n/a")} className="mt-3" />

            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              {detailBlocks.map((item) => (
                <ResultInfoBlock
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  tone="tone-secondary-muted"
                />
              ))}
            </div>

            <div className="mt-3">
              <ResultChipList items={practiceSteps} emptyLabel="No practice steps captured." />
            </div>
          </ResultSectionCard>
        </div>
      )}
    </PageSectionCard>
  );
}

function getSelectedFeedbackRow(
  rows: ReturnType<typeof buildResultSummary>["feedbackRows"],
  selectedId: string | null,
  fallbackToFirst: boolean,
) {
  const matchedRow =
    rows.find((row) => String(row.segment_id || "") === selectedId) || null;
  return matchedRow || (fallbackToFirst ? rows[0] || null : null);
}

function buildFeedbackDetailBlocks(
  focusTags: string[],
  practiceSteps: string[],
) {
  return [
    {
      label: "Focus tags",
      value: focusTags.length
        ? focusTags.join(" · ")
        : "No focus tags captured.",
    },
    {
      label: "Practice steps",
      value: practiceSteps.length
        ? practiceSteps.join(" · ")
        : "No practice steps captured.",
    },
  ];
}
