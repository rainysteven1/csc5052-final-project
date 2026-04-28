import { MetricBar } from "@/components/pipeline/MetricBar";
import { PipelineSectionBlock } from "@/components/pipeline/PipelineSectionBlock";
import { asRecord } from "@/lib/analysis-helpers";
import type { AnalysisStateResult } from "@/types/analysis";

type FinalizeSpotlightProps = {
  snapshot: Record<string, unknown>;
  current: AnalysisStateResult;
  currentMeta: Record<string, unknown>;
};

export function FinalizeSpotlight({
  snapshot,
  current,
  currentMeta,
}: FinalizeSpotlightProps) {
  const currentRecord = asRecord(current) || {};
  const resultPayload = asRecord(snapshot.result) || asRecord(currentRecord.result) || {};
  const currentStatus = typeof currentRecord.status === "string" ? currentRecord.status : "--";
  const currentWarnings = Array.isArray(currentRecord.warnings) ? currentRecord.warnings : [];
  const currentErrors = Array.isArray(currentRecord.errors) ? currentRecord.errors : [];
  const coachingModel =
    (asRecord(currentMeta.llm_coaching)?.model as string | undefined) ||
    (asRecord(currentMeta.llm_judgment)?.model as string | undefined) ||
    "n/a";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PipelineSectionBlock label="Final status">
        <div className="font-display text-3xl">
          {String(resultPayload.status || currentStatus)}
        </div>
        <div className="mt-3 space-y-3">
          <MetricBar
            label="overall score"
            value={resultPayload.overall_score}
            tone="from-indigo-400 to-slate-300"
          />
          <div className="text-sm text-muted-foreground">
            Level: {String(resultPayload.level || "--")}
          </div>
        </div>
      </PipelineSectionBlock>
      <PipelineSectionBlock label="Runtime meta">
        <div className="space-y-2 text-sm leading-6">
          <div>Warnings: {currentWarnings.length}</div>
          <div>Errors: {currentErrors.length}</div>
          <div>Engine: {String(currentMeta.workflow_engine || "n/a")}</div>
          <div>Coaching model: {String(coachingModel)}</div>
        </div>
      </PipelineSectionBlock>
    </div>
  );
}
