import crypto from 'node:crypto';
import path from 'node:path';

import cors from 'cors';
import express from 'express';
import multer from 'multer';

import { loadCatalog, loadScenarioResult, selectScenario } from './catalog.js';
import type { AnalysisEvent, AnalysisJob, JobRecord } from './types.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number.parseInt(process.env.PORT || '18080', 10);
const streamStepDelayMs = Number.parseInt(process.env.FAKE_STREAM_STEP_DELAY_MS || '3000', 10);
const streamCoachingDelayMs = Number.parseInt(
  process.env.FAKE_STREAM_COACHING_DELAY_MS || '10000',
  10
);
const catalog = loadCatalog();
const jobs = new Map<string, JobRecord>();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/v1/health', (_req, res) => {
  res.json({
    ok: true,
    mode: 'fake-backend',
    scenarios: catalog.scenarios.map((scenario) => scenario.id),
  });
});

app.get('/api/v1/demos', (_req, res) => {
  res.json({
    items: catalog.scenarios.map((scenario) => ({
      id: scenario.id,
      label: scenario.label,
      replay_path: `demo:${scenario.id}`,
      audio_filename: scenario.audioFilename,
    })),
  });
});

app.post('/api/v1/replays/load', (req, res) => {
  const requestedPath = typeof req.body?.path === 'string' ? req.body.path : '';
  const scenario = selectScenario(catalog, requestedPath);
  const result = cloneResult(loadScenarioResult(scenario.resultFile));
  res.json({ path: requestedPath || `demo:${scenario.id}`, result });
});

app.post('/api/v1/analyses', upload.single('audio'), (req, res) => {
  const scenario = selectScenario(
    catalog,
    typeof req.body?.scenario === 'string' ? req.body.scenario : null
  );
  const result = cloneResult(loadScenarioResult(scenario.resultFile));
  const transcriptOverride =
    typeof req.body?.transcript_override === 'string' ? req.body.transcript_override.trim() : '';
  applyTranscriptOverride(result, transcriptOverride || null);

  const analysisId = `demo-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const requestId = crypto.randomUUID();
  const traceId = crypto.randomUUID();
  const job = buildJob({
    analysisId,
    requestId,
    traceId,
    scenario: scenario.id,
    audioFilename: req.file?.originalname || scenario.audioFilename,
    transcriptOverride: transcriptOverride || null,
    result,
  });

  const record: JobRecord = {
    job,
    result,
    events: [],
    terminal: false,
    subscribers: new Set(),
  };
  jobs.set(analysisId, record);

  publishEvent(
    record,
    buildEvent(record.job, {
      event_type: 'job_created',
      status: 'queued',
      node: 'input',
      progress: 0,
      message: 'Fake analysis job created.',
      payload: { job: serializeJob(record.job) },
    })
  );

  void runFakeJob(record, scenario.id);
  res.status(202).json(serializeJob(record.job));
});

app.get('/api/v1/analyses/:analysisId', (req, res) => {
  const record = jobs.get(req.params.analysisId);
  if (!record) {
    return res
      .status(404)
      .json(errorPayload('analysis_not_found', `Analysis job not found: ${req.params.analysisId}`));
  }
  res.json(serializeJob(record.job));
});

app.get('/api/v1/analyses/:analysisId/result', (req, res) => {
  const record = jobs.get(req.params.analysisId);
  if (!record) {
    return res
      .status(404)
      .json(errorPayload('analysis_not_found', `Analysis job not found: ${req.params.analysisId}`));
  }
  if (!record.terminal) {
    return res
      .status(409)
      .json(errorPayload('analysis_not_ready', 'Analysis job is not finished yet.'));
  }
  res.json({
    analysis_id: record.job.analysis_id,
    status: record.job.status,
    result: record.result,
  });
});

app.get('/api/v1/analyses/:analysisId/events', (req, res) => {
  const record = jobs.get(req.params.analysisId);
  if (!record) {
    return res
      .status(404)
      .json(errorPayload('analysis_not_found', `Analysis job not found: ${req.params.analysisId}`));
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  for (const event of record.events) {
    writeSSE(res, event);
  }

  if (record.terminal) {
    res.end();
    return;
  }

  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 2000);

  record.subscribers.add(res);
  req.on('close', () => {
    clearInterval(keepAlive);
    record.subscribers.delete(res);
  });
});

app.listen(port, () => {
  console.log(`[fake-backend] listening on http://127.0.0.1:${port}`);
});

async function runFakeJob(record: JobRecord, requestedScenario: string) {
  const scenario = selectScenario(catalog, requestedScenario);

  record.job.status = 'running';
  publishEvent(
    record,
    buildEvent(record.job, {
      event_type: 'job_running',
      status: 'running',
      node: 'input',
      progress: 0.02,
      message: `Fake ${scenario.id} analysis started.`,
      payload: { job: serializeJob(record.job), state: record.result },
    })
  );

  for (let index = 0; index < scenario.timeline.length; index += 1) {
    const step = scenario.timeline[index];
    await sleep(delayForTimelineStep(step));
    const completedSteps = completedStepsForNode(step.node);
    record.job.current_node = step.node;
    record.job.completed_steps = completedSteps;
    if (step.eventType === 'analysis_completed') {
      record.job.status = 'completed';
      record.job.completed_steps = record.job.total_steps;
      record.terminal = true;
    }

    publishEvent(
      record,
      buildEvent(record.job, {
        event_type: step.eventType,
        status: step.status,
        node: step.node,
        progress: step.progress,
        message: step.message,
        payload: {
          job: serializeJob(record.job),
          state: record.result,
          result: step.eventType === 'analysis_completed' ? record.result : undefined,
          substep: step.substep,
        },
        step_index: index + 1,
        total_steps: scenario.timeline.length,
      })
    );
  }
}

function buildJob(args: {
  analysisId: string;
  requestId: string;
  traceId: string;
  scenario: string;
  audioFilename: string;
  transcriptOverride: string | null;
  result: Record<string, unknown>;
}): AnalysisJob {
  const resultRecord = asRecord(args.result.result);
  return {
    analysis_id: args.analysisId,
    request_id: args.requestId,
    trace_id: args.traceId,
    status: 'queued',
    scenario: args.scenario,
    audio_filename: args.audioFilename,
    audio_path: path.posix.join('/demo-audio', args.audioFilename),
    transcript_override: args.transcriptOverride,
    upload_wandb: false,
    result_path: `demo:${args.scenario}`,
    error: null,
    warnings: asStringArray(args.result.warnings),
    overall_score:
      typeof resultRecord?.overall_score === 'number' ? resultRecord.overall_score : null,
    level: typeof resultRecord?.level === 'string' ? resultRecord.level : null,
    summary: typeof resultRecord?.summary === 'string' ? resultRecord.summary : null,
    dominant_causes: asStringArray(resultRecord?.dominant_causes),
    current_node: 'input',
    completed_steps: 0,
    total_steps: 4,
    status_url: `/api/v1/analyses/${args.analysisId}`,
    result_url: `/api/v1/analyses/${args.analysisId}/result`,
    events_url: `/api/v1/analyses/${args.analysisId}/events`,
  };
}

function buildEvent(
  job: AnalysisJob,
  args: {
    event_type: string;
    status: string;
    node: string;
    progress: number;
    message: string;
    payload: Record<string, unknown>;
    step_index?: number;
    total_steps?: number;
  }
): AnalysisEvent {
  return {
    analysis_id: job.analysis_id,
    event_type: args.event_type,
    request_id: job.request_id,
    trace_id: job.trace_id,
    status: args.status,
    node: args.node,
    step_index: args.step_index ?? null,
    total_steps: args.total_steps ?? null,
    progress: args.progress,
    message: args.message,
    payload: args.payload,
    created_at: new Date().toISOString(),
  };
}

function publishEvent(record: JobRecord, event: AnalysisEvent) {
  record.events.push(event);
  for (const subscriber of record.subscribers) {
    writeSSE(subscriber, event);
  }
}

function writeSSE(stream: NodeJS.WritableStream, event: AnalysisEvent) {
  stream.write(`event: ${event.event_type}\n`);
  stream.write(`data: ${JSON.stringify(event)}\n\n`);
}

function serializeJob(job: AnalysisJob): AnalysisJob {
  return { ...job };
}

function errorPayload(code: string, detail: string) {
  return { code, detail };
}

function cloneResult<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function applyTranscriptOverride(
  result: Record<string, unknown>,
  transcriptOverride: string | null
) {
  if (!transcriptOverride) {
    return;
  }
  result.transcript = transcriptOverride;
  if (Array.isArray(result.segments) && result.segments.length > 0) {
    const first = asRecord(result.segments[0]);
    if (first) {
      first.text = transcriptOverride;
    }
  }
  const resultRecord = asRecord(result.result);
  if (
    resultRecord &&
    Array.isArray(resultRecord.segment_results) &&
    resultRecord.segment_results.length > 0
  ) {
    const first = asRecord(resultRecord.segment_results[0]);
    if (first) {
      first.text = transcriptOverride;
    }
  }
}

function completedStepsForNode(node: string) {
  switch (node) {
    case 'input':
      return 1;
    case 'evidence':
      return 2;
    case 'coaching':
      return 3;
    case 'finalize':
      return 4;
    default:
      return 0;
  }
}

function delayForTimelineStep(step: { eventType: string; node: string }) {
  if (step.node === 'coaching' && step.eventType === 'node_completed') {
    return streamCoachingDelayMs;
  }
  return streamStepDelayMs;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
