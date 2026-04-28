import {
  asRecord,
  asStringArray,
  average,
  formatNumber,
  normalizeAnalysisState,
  prettifyNode,
  sanitizeDisplayText,
  toRecordArray,
  truncate,
} from '@/lib/analysis-core';
import {
  getCoachingFocus,
  getCoachingStrengths,
  getCoachingSummary,
} from '@/lib/coaching-helpers';
import { getWorkflowNodes, nodeSnapshot } from '@/lib/replay-helpers';
import type {
  AnalysisStateResult,
  NodeDetail,
  NodeName,
  NodeVisual,
  SegmentLike,
} from '@/types/analysis';
import { nodeAccentClasses } from '@/types/analysis';

export function buildNodeVisuals(
  result: AnalysisStateResult | null
): NodeVisual[] {
  const normalizedResult = normalizeAnalysisState(result);
  if (!normalizedResult) {
    return ['input', 'evidence', 'coaching', 'finalize'].map((node) => ({
      node: node as NodeName,
      eyebrow: prettifyNode(node),
      title: '--',
      metric: '--',
      detail: '--',
      accent: nodeAccentClasses[node as NodeName],
    }));
  }

  const segments = normalizedResult.segments || [];
  const rawAsrSegments = normalizedResult.raw_asr_segments || [];
  const agentOutputs = asRecord(normalizedResult.agent_outputs) || {};
  const lexical = toRecordArray(agentOutputs.lexical);
  const prosody = toRecordArray(agentOutputs.prosody);
  const disfluency = toRecordArray(agentOutputs.disfluency);
  const feedback = toRecordArray(agentOutputs.feedback);
  const judgment = asRecord(agentOutputs.judgment) || {};
  const coaching = asRecord(agentOutputs.coaching) || {};
  const resultPayload = asRecord(normalizedResult.result) || {};
  const lexicalScores = lexical
    .map((item) => (typeof item.score === 'number' ? item.score : 0))
    .filter(Number.isFinite);
  const issueCount = disfluency.reduce(
    (count, item) =>
      count + (Array.isArray(item.issues) ? item.issues.length : 0),
    0
  );
  const triggerCount = lexical.reduce(
    (count, item) =>
      count + (Array.isArray(item.triggers) ? item.triggers.length : 0),
    0
  );

  return [
    {
      node: 'input',
      eyebrow: 'audio intake',
      title: truncate(
        sanitizeDisplayText(normalizedResult.transcript, 'No transcript'),
        48
      ),
      metric: `${rawAsrSegments.length} raw chunks · ${segments.length} segments`,
      detail: '',
      accent: nodeAccentClasses.input,
    },
    {
      node: 'evidence',
      eyebrow: 'evidence build',
      title: `${triggerCount} lexical triggers · ${issueCount} issue markers`,
      metric: `${prosody.length} prosody rows · avg ${formatNumber(average(lexicalScores), 2)}`,
      detail: '',
      accent: nodeAccentClasses.evidence,
    },
    {
      node: 'coaching',
      eyebrow: 'coach synthesis',
      title: truncate(
        getCoachingSummary(resultPayload, coaching, judgment),
        56
      ),
      metric: `${feedback.length} feedback blocks`,
      detail: '',
      accent: nodeAccentClasses.coaching,
    },
    {
      node: 'finalize',
      eyebrow: 'export status',
      title: String(resultPayload.status || normalizedResult.status || '--'),
      metric: formatNumber(resultPayload.overall_score, 3),
      detail: '',
      accent: nodeAccentClasses.finalize,
    },
  ];
}

export function buildNodeDetails(
  node: NodeName,
  result: AnalysisStateResult | null,
  payload: Record<string, unknown> | null
): NodeDetail {
  const snapshot =
    asRecord(payload?.node_snapshot) ||
    asRecord(payload?.state) ||
    (result ? nodeSnapshot(node, result) : null);
  const stateFromPayload = normalizeAnalysisState(payload?.state);
  const current = stateFromPayload || normalizeAnalysisState(result);
  const currentRecord = asRecord(current) || {};
  const currentAgentOutputs = asRecord(currentRecord.agent_outputs) || {};
  const currentMeta = asRecord(currentRecord.meta) || {};
  const currentSegments = Array.isArray(current?.segments)
    ? current.segments
    : [];
  const currentRawAsrSegments = Array.isArray(current?.raw_asr_segments)
    ? current.raw_asr_segments
    : [];
  const currentWarnings = Array.isArray(current?.warnings)
    ? current.warnings
    : [];
  const currentErrors = Array.isArray(current?.errors) ? current.errors : [];
  const currentStatus =
    typeof currentRecord.status === 'string' ? currentRecord.status : '--';
  const currentTranscript = sanitizeDisplayText(currentRecord.transcript, '--');

  if (!snapshot || !current) {
    return {
      title: prettifyNode(node),
      summary: '--',
      stats: [],
      bullets: [],
    };
  }

  if (node === 'input') {
    const audio = asRecord(snapshot.audio) || {};
    const rawSegments = Array.isArray(snapshot.raw_asr_segments)
      ? snapshot.raw_asr_segments
      : Array.isArray(currentRawAsrSegments)
        ? currentRawAsrSegments
        : [];
    const segments = Array.isArray(snapshot.segments)
      ? (snapshot.segments as SegmentLike[])
      : (currentSegments as SegmentLike[]);
    return {
      title: 'Input stage',
      summary: sanitizeDisplayText(
        snapshot.transcript || currentTranscript,
        '--'
      ),
      stats: [
        { label: 'Format', value: String(audio.format || 'n/a') },
        {
          label: 'ASR mode',
          value: String(snapshot.asr_mode || currentMeta.asr_mode || 'n/a'),
        },
        { label: 'Raw chunks', value: String(rawSegments.length) },
        { label: 'Segments', value: String(segments.length) },
      ],
      bullets: [
        `Source: ${String(audio.source_path || 'n/a')}`,
        `Normalized: ${String(audio.normalized_path || 'n/a')}`,
        ...segments
          .slice(0, 2)
          .map(
            (segment) =>
              `${segment.segment_id}: ${truncate(String(segment.text || ''), 72)}`
          ),
      ],
    };
  }

  if (node === 'evidence') {
    const lexical = Array.isArray(snapshot.lexical)
      ? toRecordArray(snapshot.lexical)
      : toRecordArray(currentAgentOutputs.lexical);
    const prosody = Array.isArray(snapshot.prosody)
      ? toRecordArray(snapshot.prosody)
      : toRecordArray(currentAgentOutputs.prosody);
    const disfluency = Array.isArray(snapshot.disfluency)
      ? toRecordArray(snapshot.disfluency)
      : toRecordArray(currentAgentOutputs.disfluency);
    const context =
      asRecord(snapshot.context) || asRecord(currentAgentOutputs.context) || {};
    const evidenceSummary =
      asRecord(snapshot.evidence_summary) ||
      asRecord(currentAgentOutputs.evidence_summary) ||
      {};
    const issues = disfluency.flatMap((row) => toRecordArray(row.issues));
    return {
      title: 'Evidence stage',
      summary:
        'Rule-driven signals are extracted and grouped into a unified evidence payload.',
      stats: [
        { label: 'Lexical rows', value: String(lexical.length) },
        { label: 'Prosody rows', value: String(prosody.length) },
        { label: 'Issues', value: String(issues.length) },
        {
          label: 'Constraints',
          value: String(asStringArray(context.style_constraints).length),
        },
        {
          label: 'Evidence segments',
          value: String(evidenceSummary.segment_count || 0),
        },
      ],
      bullets: [
        ...(Array.isArray(evidenceSummary.dominant_dimensions)
          ? evidenceSummary.dominant_dimensions
          : []
        ).map((item) => `dimension: ${String(item)}`),
        ...(Array.isArray(evidenceSummary.top_lexical_triggers)
          ? evidenceSummary.top_lexical_triggers
          : []
        )
          .slice(0, 2)
          .map((item) => {
            const row = asRecord(item) || {};
            return `top lexical: ${String(row.label || 'n/a')} ×${String(row.count || 0)}`;
          }),
        ...(Array.isArray(evidenceSummary.top_disfluency_patterns)
          ? evidenceSummary.top_disfluency_patterns
          : []
        )
          .slice(0, 2)
          .map((item) => {
            const row = asRecord(item) || {};
            return `top disfluency: ${String(row.label || 'n/a')} ×${String(row.count || 0)}`;
          }),
        ...lexical.flatMap((row) => asStringArray(row.triggers)).slice(0, 4),
        ...issues
          .slice(0, 4)
          .map(
            (issue) =>
              `${String(issue.type)} · ${String(issue.text)} ×${String(issue.count ?? 1)}`
          ),
        ...asStringArray(context.style_constraints).slice(0, 2),
        ...asStringArray(evidenceSummary.signal_overview).slice(0, 2),
      ].slice(0, 8),
    };
  }

  if (node === 'coaching') {
    const judgment =
      asRecord(snapshot.judgment) ||
      asRecord(currentAgentOutputs.judgment) ||
      {};
    const coaching =
      asRecord(snapshot.coaching) ||
      asRecord(currentAgentOutputs.coaching) ||
      {};
    const feedback = Array.isArray(snapshot.feedback)
      ? toRecordArray(snapshot.feedback)
      : toRecordArray(currentAgentOutputs.feedback);
    const resultPayload =
      asRecord(snapshot.result) || asRecord(currentRecord.result) || {};
    const focusItems = getCoachingFocus(coaching, judgment);
    const strengths = getCoachingStrengths(coaching, judgment);
    return {
      title: 'Coaching stage',
      summary: getCoachingSummary(resultPayload, coaching, judgment),
      stats: [
        {
          label: 'Overall score',
          value: formatNumber(resultPayload.overall_score, 3),
        },
        { label: 'Level', value: String(resultPayload.level || '--') },
        {
          label: 'Dominant causes',
          value: String(asStringArray(resultPayload.dominant_causes).length),
        },
        { label: 'Feedback rows', value: String(feedback.length) },
      ],
      bullets: [
        ...asStringArray(resultPayload.dominant_causes),
        ...focusItems,
        ...strengths,
        ...asStringArray(judgment.risk_segments).map(
          (item) => `risk segment: ${item}`
        ),
        ...feedback
          .slice(0, 2)
          .map(
            (row) =>
              `${String(row.segment_id)} · ${truncate(String(row.rewrite || row.problem || ''), 72)}`
          ),
      ].slice(0, 6),
    };
  }

  const resultPayload =
    asRecord(snapshot.result) || asRecord(currentRecord.result) || {};
  return {
    title: 'Finalize stage',
    summary: 'Final JSON export is ready for downstream UI, storage or replay.',
    stats: [
      { label: 'Status', value: String(resultPayload.status || currentStatus) },
      {
        label: 'Warnings',
        value: String(
          (Array.isArray(snapshot.warnings)
            ? snapshot.warnings
            : currentWarnings
          ).length
        ),
      },
      {
        label: 'Errors',
        value: String(
          (Array.isArray(snapshot.errors) ? snapshot.errors : currentErrors)
            .length
        ),
      },
      { label: 'Nodes', value: String(getWorkflowNodes(current).length) },
    ],
    bullets: [
      `Summary: ${truncate(String(resultPayload.summary || 'n/a'), 90)}`,
      `Dominant causes: ${asStringArray(resultPayload.dominant_causes).join(', ') || 'n/a'}`,
      `Workflow nodes: ${getWorkflowNodes(current).join(' -> ')}`,
    ],
  };
}

export function getSelectedNodeSnapshot(
  node: NodeName,
  result: AnalysisStateResult | null,
  payload: Record<string, unknown> | null
) {
  return (
    asRecord(payload?.node_snapshot) ||
    asRecord(payload?.state) ||
    (result ? nodeSnapshot(node, result) : null)
  );
}
