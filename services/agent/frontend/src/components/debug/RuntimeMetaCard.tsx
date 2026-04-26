import { ScrollArea } from "@/components/ui/scroll-area";
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
  const llmReasoning = asRecord(meta.llm_reasoning) || {};
  const llmFeedback = asRecord(meta.llm_feedback) || {};

  return (
    <PageSectionCard
      eyebrow="Debug"
      title="Metadata"
      className={cn("h-full", className)}
      contentClassName="min-h-0 flex-1"
    >
      <ScrollArea className="h-full pr-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <MetaTile label="Request ID" value={summary.requestId || "n/a"} />
          <MetaTile label="Scenario" value={summary.scenario || "n/a"} />
          <MetaTile label="Workflow engine" value={String(meta.workflow_engine || "n/a")} />
          <MetaTile label="Language" value={String(meta.language || "n/a")} />
          <MetaTile label="ASR mode" value={String(meta.asr_mode || "n/a")} />
          <MetaTile label="Reasoning model" value={String(llmReasoning.model || "n/a")} />
          <MetaTile label="Feedback model" value={String(llmFeedback.model || "n/a")} />
          <MetaTile label="Nodes" value={getWorkflowNodes(finalState).join(" -> ")} long />
        </div>
      </ScrollArea>
    </PageSectionCard>
  );
}

type MetaTileProps = {
  label: string;
  value: string;
  long?: boolean;
};

function MetaTile({ label, value, long = false }: MetaTileProps) {
  return (
    <div className="rounded-[20px] border border-stone-300/70 bg-stone-100/85 p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">{label}</div>
      <div className={cn(long ? "mt-2 text-sm leading-6 text-stone-900" : "mt-2 text-sm font-medium text-stone-900")}>{value || "--"}</div>
    </div>
  );
}
