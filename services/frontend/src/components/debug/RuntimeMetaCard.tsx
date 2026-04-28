import { MetaTile } from "@/components/debug/MetaTile";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { asRecord, buildResultSummary, getWorkflowNodes } from "@/lib/analysis-helpers";
import { cn } from "@/lib/utils";
import { useAnalysisStore } from "@/store/analysis-store";

type RuntimeMetaCardProps = {
  className?: string;
};

export function RuntimeMetaCard({ className }: RuntimeMetaCardProps) {
  const finalState = useAnalysisStore((state) => state.finalState);
  const job = useAnalysisStore((state) => state.job);
  const summary = buildResultSummary(finalState, job);
  const meta = asRecord(finalState?.meta) || {};
  const llmCoaching = asRecord(meta.llm_coaching) || asRecord(meta.llm_judgment) || {};

  return (
    <PageSectionCard
      eyebrow="Debug"
      title="Metadata"
      className={cn("h-full", className)}
      contentClassName="flex min-h-0 flex-1 flex-col gap-3"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <MetaTile label="Request ID" value={summary.requestId || "n/a"} />
        <MetaTile label="Scenario" value={summary.scenario || "n/a"} />
        <MetaTile label="Workflow engine" value={String(meta.workflow_engine || "n/a")} />
        <MetaTile label="Language" value={String(meta.language || "n/a")} />
        <MetaTile label="ASR mode" value={String(meta.asr_mode || "n/a")} />
        <MetaTile label="Coaching provider" value={summary.coachingProvider || "n/a"} />
        <MetaTile label="Coaching model" value={String(llmCoaching.model || summary.coachingModel || "n/a")} />
        <MetaTile label="Nodes" value={getWorkflowNodes(finalState).join(" -> ")} long />
      </div>
    </PageSectionCard>
  );
}
