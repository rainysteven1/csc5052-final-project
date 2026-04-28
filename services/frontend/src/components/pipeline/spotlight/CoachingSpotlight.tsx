import { PipelineInfoBlock } from "@/components/pipeline/PipelineInfoBlock";
import { PipelineSectionBlock } from "@/components/pipeline/PipelineSectionBlock";
import { SurfaceCalloutList } from "@/components/shared/SurfaceCalloutList";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import {
  asRecord,
  asStringArray,
  getCoachingFocus,
  getCoachingStrengths,
  getCoachingSummary,
} from "@/lib/analysis-helpers";

import { SpotlightChipList } from "@/components/pipeline/spotlight/SpotlightPrimitives";

type CoachingSpotlightProps = {
  snapshot: Record<string, unknown>;
  currentAgentOutputs: Record<string, unknown>;
  currentResult: Record<string, unknown>;
};

export function CoachingSpotlight({
  snapshot,
  currentAgentOutputs,
  currentResult,
}: CoachingSpotlightProps) {
  const judgment = asRecord(snapshot.judgment) || asRecord(currentAgentOutputs.judgment) || {};
  const coaching = asRecord(snapshot.coaching) || asRecord(currentAgentOutputs.coaching) || {};
  const feedback = toRecordArray(
    Array.isArray(snapshot.feedback) ? snapshot.feedback : currentAgentOutputs.feedback,
  );
  const resultPayload = asRecord(snapshot.result) || asRecord(currentResult) || {};
  const focusItems = getCoachingFocus(coaching, judgment);
  const strengths = getCoachingStrengths(coaching, judgment);

  return (
    <div className="space-y-4">
      <PipelineSectionBlock label="Narrative summary">
        <div className="text-sm leading-7">{getCoachingSummary(resultPayload, coaching, judgment)}</div>
      </PipelineSectionBlock>
      <div className="grid gap-4 xl:grid-cols-2">
        <PipelineSectionBlock label="Dominant causes">
          <SpotlightChipList items={asStringArray(resultPayload.dominant_causes)} />
        </PipelineSectionBlock>
        <PipelineSectionBlock label="Coaching focus">
          <SurfaceCalloutList items={focusItems} itemClassName="text-sm" />
        </PipelineSectionBlock>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <PipelineSectionBlock label="Strengths">
          <SpotlightChipList items={strengths} />
        </PipelineSectionBlock>
        <PipelineSectionBlock label="Risk segments">
          <SpotlightChipList items={asStringArray(judgment.risk_segments)} />
        </PipelineSectionBlock>
      </div>
      <div className="space-y-4">
        {feedback.slice(0, 4).map((row) => (
          <PipelineSectionBlock
            key={String(row.segment_id)}
            label={String(row.segment_id)}
            bodyClassName="space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="font-medium">{String(row.segment_id)}</div>
              <SeverityBadge severity={typeof row.severity === "string" ? row.severity : null} />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <PipelineInfoBlock label="Problem" value={String(row.problem || row.reason || "n/a")} tone="tone-secondary-soft" />
              <PipelineInfoBlock label="Rewrite" value={String(row.rewrite || "n/a")} tone="tone-accent-soft" />
            </div>
          </PipelineSectionBlock>
        ))}
      </div>
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
