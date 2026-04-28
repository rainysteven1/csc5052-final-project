import type {
  ApiErrorResponse,
  IssueTone,
  RuntimeIssue,
} from '@/types/analysis';

const errorMessageByCode: Record<string, string> = {
  audio_upload_required:
    'Please upload an audio file before starting the analysis.',
  audio_open_failed: 'The backend could not open the uploaded audio file.',
  audio_read_failed: 'The backend could not read the uploaded audio file.',
  analysis_create_failed: 'The backend could not create a new analysis job.',
  analysis_list_failed: 'The backend could not load the analysis list.',
  analysis_lookup_failed: 'The backend could not look up this analysis job.',
  analysis_not_found: 'The requested analysis job does not exist anymore.',
  analysis_not_ready:
    'This analysis is still running. Wait for completion and try again.',
  analysis_result_not_found:
    'The analysis finished, but its result file could not be loaded.',
  replay_request_invalid:
    'The replay request is invalid. Check the JSON file path and try again.',
  replay_not_found: 'The replay file could not be found or opened.',
};

const toneByCode: Record<string, IssueTone> = {
  audio_upload_required: 'warning',
  analysis_not_ready: 'warning',
  replay_request_invalid: 'warning',
};

export function makeRuntimeIssue(
  message: string,
  tone: IssueTone = 'destructive',
  meta?: Partial<Pick<RuntimeIssue, 'code' | 'requestId' | 'traceId'>>
): RuntimeIssue {
  return {
    message,
    tone,
    code: meta?.code,
    requestId: meta?.requestId,
    traceId: meta?.traceId,
  };
}

export async function parseApiError(
  response: Response,
  fallbackPrefix: string
): Promise<RuntimeIssue> {
  let payload: ApiErrorResponse | null = null;

  try {
    payload = (await response.json()) as ApiErrorResponse;
  } catch {
    payload = null;
  }

  const mapped = payload?.code ? errorMessageByCode[payload.code] : null;
  const detail = payload?.detail?.trim();
  const tone = payload?.code
    ? toneByCode[payload.code] || 'destructive'
    : response.status >= 500
      ? 'destructive'
      : 'warning';
  const meta = {
    code: payload?.code,
    requestId: payload?.request_id,
    traceId: payload?.trace_id,
  };

  if (mapped && detail && detail !== mapped) {
    return makeRuntimeIssue(`${mapped} Details: ${detail}`, tone, meta);
  }
  if (mapped) {
    return makeRuntimeIssue(mapped, tone, meta);
  }
  if (detail) {
    return makeRuntimeIssue(detail, tone, meta);
  }
  return makeRuntimeIssue(`${fallbackPrefix}: ${response.status}`, tone, meta);
}
