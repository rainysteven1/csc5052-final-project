import type {
  AnalysisStateResult,
  KeyValueItem,
  NodeName,
  SegmentLike,
} from '@/types/analysis';

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function toRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item));
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function prettifyNode(node?: string | null) {
  return (node || 'waiting').replace(/_/g, ' ');
}

export function normalizeNodeName(node?: string | null): NodeName {
  switch (node) {
    case 'prepare_input':
    case 'asr':
    case 'segment':
    case 'input':
      return 'input';
    case 'lexical':
    case 'prosody':
    case 'disfluency':
    case 'context':
    case 'merge_analysis':
    case 'evidence':
      return 'evidence';
    case 'judgment':
    case 'rewrite_feedback':
    case 'feedback':
    case 'coaching':
      return 'coaching';
    case 'serialize_result':
    case 'finalize':
    default:
      return 'finalize';
  }
}

export function statusTone(status?: string | null) {
  if (status === 'completed') return 'accent';
  if (status === 'failed') return 'destructive';
  if (status === 'running') return 'default';
  return 'outline';
}

export function truncate(text: string, limit = 72) {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length <= limit
    ? compact
    : `${compact.slice(0, limit - 3)}...`;
}

export function sanitizeDisplayText(value: unknown, fallback = '--') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return fallback;
  }

  if (/^this is a placeholder transcript/i.test(compact)) {
    return 'Transcript unavailable.';
  }

  return compact;
}

export function formatNumber(value: unknown, digits = 3) {
  return typeof value === 'number' ? value.toFixed(digits) : '--';
}

export function formatSeconds(value: unknown) {
  return typeof value === 'number' ? `${value.toFixed(2)}s` : 'n/a';
}

export function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

export function scoreToPercent(value: unknown) {
  return typeof value === 'number'
    ? Math.max(0, Math.min(100, value * 100))
    : 0;
}

export function makeStat(label: string, value: string): KeyValueItem {
  return { label, value };
}

export function normalizeAnalysisState(
  value: unknown
): AnalysisStateResult | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const agentOutputs = asRecord(record.agent_outputs) || {};

  return {
    request_id:
      typeof record.request_id === 'string' ? record.request_id : 'pending',
    status: typeof record.status === 'string' ? record.status : 'running',
    scenario:
      typeof record.scenario === 'string' ? record.scenario : 'presentation',
    audio: asRecord(record.audio) || {},
    artifacts: asRecord(record.artifacts) || {},
    transcript: sanitizeDisplayText(record.transcript, ''),
    raw_asr_segments: Array.isArray(record.raw_asr_segments)
      ? (record.raw_asr_segments as SegmentLike[])
      : [],
    segments: Array.isArray(record.segments)
      ? (record.segments as SegmentLike[])
      : [],
    agent_outputs: {
      lexical: toRecordArray(agentOutputs.lexical),
      prosody: toRecordArray(agentOutputs.prosody),
      disfluency: toRecordArray(agentOutputs.disfluency),
      context: asRecord(agentOutputs.context) || {},
      evidence_summary: asRecord(agentOutputs.evidence_summary) || {},
      judgment: asRecord(agentOutputs.judgment) || {},
      coaching: asRecord(agentOutputs.coaching) || {},
      feedback: toRecordArray(agentOutputs.feedback),
    },
    result: asRecord(record.result) || {},
    warnings: asStringArray(record.warnings),
    errors: asStringArray(record.errors),
    meta: asRecord(record.meta) || {},
  };
}
