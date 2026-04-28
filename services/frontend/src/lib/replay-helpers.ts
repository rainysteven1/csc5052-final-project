import {
  asRecord,
  asStringArray,
  normalizeNodeName,
  prettifyNode,
} from '@/lib/analysis-core';
import type {
  AnalysisEvent,
  AnalysisJob,
  AnalysisStateResult,
  NodeName,
} from '@/types/analysis';
import { pipelineOrder } from '@/types/analysis';

export function getWorkflowNodes(
  result: AnalysisStateResult | null
): NodeName[] {
  const meta = asRecord(result?.meta);
  const nodes = meta?.workflow_nodes;
  if (!Array.isArray(nodes) || !nodes.length) {
    return pipelineOrder;
  }

  const normalized: NodeName[] = [];
  for (const item of nodes) {
    const phase = normalizeNodeName(String(item));
    if (normalized[normalized.length - 1] !== phase) {
      normalized.push(phase);
    }
  }
  return normalized.length ? normalized : pipelineOrder;
}

export function getWorkflowSubsteps(
  result: AnalysisStateResult | null,
  node: NodeName
): string[] {
  const meta = asRecord(result?.meta);
  const substeps = asRecord(meta?.workflow_substeps)?.[node];
  return Array.isArray(substeps) ? substeps.map((item) => String(item)) : [];
}

export function getActiveSubstep(
  payload: Record<string, unknown> | null,
  node: NodeName
): string | null {
  if (!payload) {
    return null;
  }
  const payloadNode =
    typeof payload.node === 'string' ? normalizeNodeName(payload.node) : null;
  if (payloadNode && payloadNode !== node) {
    return null;
  }
  const substep = payload.substep;
  return typeof substep === 'string' ? substep : null;
}

export function nodeSnapshot(
  node: NodeName,
  result: AnalysisStateResult
): Record<string, unknown> {
  const agentOutputs = asRecord(result.agent_outputs) || {};
  const meta = asRecord(result.meta) || {};

  if (node === 'input') {
    return {
      audio: result.audio,
      transcript: result.transcript,
      raw_asr_segments: result.raw_asr_segments,
      segments: result.segments,
      asr_mode: meta.asr_mode,
      language: meta.language,
      meta,
    };
  }

  if (node === 'evidence') {
    return {
      lexical: Array.isArray(agentOutputs.lexical) ? agentOutputs.lexical : [],
      prosody: Array.isArray(agentOutputs.prosody) ? agentOutputs.prosody : [],
      disfluency: Array.isArray(agentOutputs.disfluency)
        ? agentOutputs.disfluency
        : [],
      context: asRecord(agentOutputs.context) || {},
      evidence_summary: asRecord(agentOutputs.evidence_summary) || {},
      segments: result.segments,
      warnings: result.warnings,
    };
  }

  if (node === 'coaching') {
    return {
      judgment: asRecord(agentOutputs.judgment) || {},
      coaching: asRecord(agentOutputs.coaching) || {},
      feedback: Array.isArray(agentOutputs.feedback)
        ? agentOutputs.feedback
        : [],
      result: result.result,
      segments: result.segments,
    };
  }

  return {
    result: result.result,
    warnings: result.warnings,
    errors: result.errors,
    meta,
    agent_outputs: agentOutputs,
  };
}

export function buildReplayEvents(
  result: AnalysisStateResult,
  replayPath: string
): { job: AnalysisJob; events: AnalysisEvent[] } {
  const normalizedResult = result;
  const nodes = getWorkflowNodes(normalizedResult);
  const baseTime = Date.now();
  const audio = asRecord(normalizedResult.audio);
  const sourcePath =
    typeof audio?.source_path === 'string' ? audio.source_path : replayPath;
  const audioFilename = sourcePath.split('/').pop() || 'replay.json';
  const resultPayload = asRecord(normalizedResult.result) || {};
  const overallScore =
    typeof resultPayload.overall_score === 'number'
      ? resultPayload.overall_score
      : null;
  const level =
    typeof resultPayload.level === 'string' ? resultPayload.level : null;
  const summary =
    typeof resultPayload.summary === 'string' ? resultPayload.summary : null;
  const dominantCauses = asStringArray(resultPayload.dominant_causes);

  const job: AnalysisJob = {
    analysis_id: `replay_${normalizedResult.request_id}`,
    status: normalizedResult.status === 'failed' ? 'failed' : 'completed',
    scenario: normalizedResult.scenario,
    audio_filename: audioFilename,
    audio_path: sourcePath,
    transcript_override: null,
    upload_wandb: false,
    result_path: replayPath,
    warnings: normalizedResult.warnings,
    overall_score: overallScore,
    level,
    summary,
    dominant_causes: dominantCauses,
    current_node: 'finalize',
    completed_steps: nodes.length,
    total_steps: nodes.length,
    error: normalizedResult.errors[0] || null,
  };

  const events: AnalysisEvent[] = nodes.map((node, index) => ({
    analysis_id: job.analysis_id,
    event_type: 'node_completed',
    status: job.status,
    node,
    step_index: index + 1,
    total_steps: nodes.length,
    progress: (index + 1) / nodes.length,
    message: `Replay snapshot loaded for ${prettifyNode(node)}.`,
    payload: {
      replay: true,
      replay_path: replayPath,
      node_snapshot: nodeSnapshot(node, normalizedResult),
      state: normalizedResult,
      job: {
        ...job,
        current_node: node,
        completed_steps: index + 1,
      },
    },
    created_at: new Date(baseTime + index * 800).toISOString(),
  }));

  events.push({
    analysis_id: job.analysis_id,
    event_type: 'analysis_completed',
    status: job.status,
    node: 'finalize',
    step_index: nodes.length,
    total_steps: nodes.length,
    progress: 1,
    message: `Replay loaded from ${replayPath}.`,
    payload: {
      replay: true,
      replay_path: replayPath,
      result: normalizedResult,
      job,
    },
    created_at: new Date(baseTime + nodes.length * 800).toISOString(),
  });

  return { job, events };
}
