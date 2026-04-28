import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { RuntimeIssueBanner } from "@/components/shared/RuntimeIssueBanner";
import { SessionEmptyState } from "@/components/run/SessionEmptyState";
import { SessionStatusCard } from "@/components/run/SessionStatusCard";
import { SessionSummaryBox } from "@/components/run/SessionSummaryBox";
import { prettifyNode } from "@/lib/analysis-helpers";
import { useAnalysisStore } from "@/store/analysis-store";

export function SessionOverviewCard() {
  const job = useAnalysisStore((state) => state.job);
  const activeNode = useAnalysisStore((state) => state.activeNode);
  const error = useAnalysisStore((state) => state.error);
  const dismissError = useAnalysisStore((state) => state.dismissError);

  return (
    <PageSectionCard
      eyebrow="Session"
      title="Session summary"
      className="h-full"
      contentClassName="flex min-h-0 flex-1 flex-col gap-5"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <SessionSummaryBox label="Current node" value={prettifyNode(job?.current_node || activeNode)} />
        <SessionSummaryBox label="Analysis ID" value={job?.analysis_id || "--"} />
      </div>

      {error ? <RuntimeIssueBanner issue={error} onDismiss={dismissError} /> : null}

      {job ? (
        <div className="grid gap-4">
          <SessionStatusCard job={job} />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <SessionSummaryBox label="Summary" value={job.summary || "--"} large />
            <SessionSummaryBox label="Dominant causes" value={job.dominant_causes.join(", ") || "--"} large />
          </div>
        </div>
      ) : (
        <SessionEmptyState />
      )}
    </PageSectionCard>
  );
}
