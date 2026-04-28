import { asRecord, asStringArray } from '@/lib/analysis-core';
import type {
  AnalysisJob,
  AnalysisStateResult,
  ResultSummary,
  SegmentLike,
} from '@/types/analysis';

export function getCoachingSummary(
  resultPayload: Record<string, unknown>,
  coaching: Record<string, unknown>,
  judgment: Record<string, unknown>
) {
  return String(
    resultPayload.summary || coaching.summary || judgment.summary || '--'
  );
}

export function getCoachingFocus(
  coaching: Record<string, unknown>,
  judgment: Record<string, unknown>
) {
  if (asStringArray(coaching.coaching_focus).length) {
    return asStringArray(coaching.coaching_focus);
  }
  return asStringArray(judgment.coaching_focus);
}

export function getCoachingStrengths(
  coaching: Record<string, unknown>,
  judgment: Record<string, unknown>
) {
  if (asStringArray(coaching.strengths).length) {
    return asStringArray(coaching.strengths);
  }
  return asStringArray(judgment.strengths);
}

export function buildResultSummary(
  finalState: AnalysisStateResult | null,
  job: AnalysisJob | null
): ResultSummary {
  const resultPayload = asRecord(finalState?.result) || {};
  const agentOutputs = asRecord(finalState?.agent_outputs) || {};
  const coaching = asRecord(agentOutputs.coaching) || {};
  const judgment = asRecord(agentOutputs.judgment) || {};
  const feedbackRows = Array.isArray(finalState?.agent_outputs?.feedback)
    ? finalState.agent_outputs.feedback
    : [];
  const segmentResults = Array.isArray(resultPayload.segment_results)
    ? (resultPayload.segment_results as SegmentLike[])
    : finalState?.segments || [];
  const coachingFocus = getCoachingFocus(coaching, judgment);
  const strengths = getCoachingStrengths(coaching, judgment);
  const coachingSummary = getCoachingSummary(resultPayload, coaching, judgment);

  return {
    overallScore:
      typeof resultPayload.overall_score === 'number'
        ? resultPayload.overall_score
        : typeof job?.overall_score === 'number'
          ? job.overall_score
          : null,
    riskScore:
      typeof resultPayload.risk_score === 'number'
        ? resultPayload.risk_score
        : typeof job?.risk_score === 'number'
          ? job.risk_score
          : null,
    level:
      typeof resultPayload.level === 'string'
        ? resultPayload.level
        : job?.level || null,
    summary:
      coachingSummary !== '--' ? coachingSummary : String(job?.summary || '--'),
    dominantCauses: asStringArray(resultPayload.dominant_causes).length
      ? asStringArray(resultPayload.dominant_causes)
      : job?.dominant_causes || [],
    coachingFocus,
    strengths,
    warnings: finalState?.warnings || job?.warnings || [],
    errors: finalState?.errors || (job?.error ? [job.error] : []),
    feedbackRows,
    segmentResults,
    transcript: finalState?.transcript || '',
    requestId: finalState?.request_id || job?.analysis_id || null,
    scenario: finalState?.scenario || job?.scenario || null,
    coachingProvider:
      typeof coaching.provider === 'string' ? coaching.provider : null,
    coachingModel: typeof coaching.model === 'string' ? coaching.model : null,
  };
}
