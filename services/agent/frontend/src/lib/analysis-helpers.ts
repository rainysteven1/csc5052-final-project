import {
  type AnalysisEvent,
  type AnalysisJob,
  type AnalysisStateResult,
  type KeyValueItem,
  type NodeDetail,
  type NodeName,
  type NodeVisual,
  type ResultSummary,
  type SegmentLike,
  nodeAccentClasses,
  pipelineOrder,
} from "@/types/analysis";

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function prettifyNode(node?: string | null) {
  return (node || "waiting").replace(/_/g, " ");
}

export function statusTone(status?: string | null) {
  if (status === "completed") return "accent";
  if (status === "failed") return "destructive";
  if (status === "running") return "default";
  return "outline";
}

export function truncate(text: string, limit = 72) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length <= limit ? compact : `${compact.slice(0, limit - 3)}...`;
}

export function formatNumber(value: unknown, digits = 3) {
  return typeof value === "number" ? value.toFixed(digits) : "--";
}

export function formatSeconds(value: unknown) {
  return typeof value === "number" ? `${value.toFixed(2)}s` : "n/a";
}

export function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function scoreToPercent(value: unknown) {
  return typeof value === "number" ? Math.max(0, Math.min(100, value * 100)) : 0;
}

export function getWorkflowNodes(result: AnalysisStateResult | null) {
  const meta = asRecord(result?.meta);
  const nodes = meta?.workflow_nodes;
  return Array.isArray(nodes) && nodes.length ? nodes.map((item) => String(item)) : pipelineOrder;
}

export function nodeSnapshot(node: NodeName, result: AnalysisStateResult): Record<string, unknown> {
  const agentOutputs = asRecord(result.agent_outputs) || {};
  const meta = asRecord(result.meta) || {};
  switch (node) {
    case "prepare_input":
      return { audio: result.audio, meta };
    case "asr":
      return {
        transcript: result.transcript,
        raw_asr_segments: result.raw_asr_segments,
        asr_mode: meta.asr_mode,
        language: meta.language,
      };
    case "segment":
      return { segments: result.segments };
    case "lexical":
      return { lexical: Array.isArray(agentOutputs.lexical) ? agentOutputs.lexical : [], segments: result.segments };
    case "prosody":
      return { prosody: Array.isArray(agentOutputs.prosody) ? agentOutputs.prosody : [], segments: result.segments };
    case "disfluency":
      return { disfluency: Array.isArray(agentOutputs.disfluency) ? agentOutputs.disfluency : [], segments: result.segments };
    case "context":
      return { context: asRecord(agentOutputs.context) || {} };
    case "merge_analysis":
      return { segments: result.segments, warnings: result.warnings };
    case "reasoning":
      return { reasoning: asRecord(agentOutputs.reasoning) || {}, result: result.result };
    case "feedback":
      return { feedback: Array.isArray(agentOutputs.feedback) ? agentOutputs.feedback : [], segments: result.segments };
    case "serialize_result":
      return { result: result.result, warnings: result.warnings, errors: result.errors, meta };
  }
}

export function buildReplayEvents(result: AnalysisStateResult, replayPath: string): { job: AnalysisJob; events: AnalysisEvent[] } {
  const nodes = getWorkflowNodes(result) as NodeName[];
  const baseTime = Date.now();
  const audio = asRecord(result.audio);
  const sourcePath = typeof audio?.source_path === "string" ? audio.source_path : replayPath;
  const audioFilename = sourcePath.split("/").pop() || "replay.json";
  const resultPayload = asRecord(result.result) || {};
  const overallScore = typeof resultPayload.overall_score === "number" ? resultPayload.overall_score : null;
  const level = typeof resultPayload.level === "string" ? resultPayload.level : null;
  const summary = typeof resultPayload.summary === "string" ? resultPayload.summary : null;
  const dominantCauses = asStringArray(resultPayload.dominant_causes);

  const job: AnalysisJob = {
    analysis_id: `replay_${result.request_id}`,
    status: result.status === "failed" ? "failed" : "completed",
    scenario: result.scenario,
    audio_filename: audioFilename,
    audio_path: sourcePath,
    transcript_override: null,
    upload_wandb: false,
    result_path: replayPath,
    warnings: result.warnings,
    overall_score: overallScore,
    level,
    summary,
    dominant_causes: dominantCauses,
    current_node: "serialize_result",
    completed_steps: nodes.length,
    total_steps: nodes.length,
    error: result.errors[0] || null,
  };

  const events: AnalysisEvent[] = nodes.map((node, index) => ({
    analysis_id: job.analysis_id,
    event_type: "node_completed",
    status: job.status,
    node,
    step_index: index + 1,
    total_steps: nodes.length,
    progress: (index + 1) / nodes.length,
    message: `Replay snapshot loaded for ${prettifyNode(node)}.`,
    payload: {
      replay: true,
      replay_path: replayPath,
      node_snapshot: nodeSnapshot(node, result),
      state: result,
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
    event_type: "analysis_completed",
    status: job.status,
    node: "serialize_result",
    step_index: nodes.length,
    total_steps: nodes.length,
    progress: 1,
    message: `Replay loaded from ${replayPath}.`,
    payload: {
      replay: true,
      replay_path: replayPath,
      result,
      job,
    },
    created_at: new Date(baseTime + nodes.length * 800).toISOString(),
  });

  return { job, events };
}

export function buildNodeVisuals(result: AnalysisStateResult | null): NodeVisual[] {
  if (!result) {
    return pipelineOrder.map((node) => ({
      node,
      eyebrow: prettifyNode(node),
      title: "--",
      metric: "--",
      detail: "--",
      accent: nodeAccentClasses[node],
    }));
  }

  const segments = result.segments || [];
  const rawAsrSegments = result.raw_asr_segments || [];
  const meta = asRecord(result.meta) || {};
  const audio = asRecord(result.audio) || {};
  const agentOutputs = asRecord(result.agent_outputs) || {};
  const lexical = Array.isArray(agentOutputs.lexical) ? agentOutputs.lexical : [];
  const prosody = Array.isArray(agentOutputs.prosody) ? agentOutputs.prosody : [];
  const disfluency = Array.isArray(agentOutputs.disfluency) ? agentOutputs.disfluency : [];
  const feedback = Array.isArray(agentOutputs.feedback) ? agentOutputs.feedback : [];
  const context = asRecord(agentOutputs.context) || {};
  const reasoning = asRecord(agentOutputs.reasoning) || {};
  const resultPayload = asRecord(result.result) || {};
  const lexicalScores = lexical.map((item) => (typeof item.score === "number" ? item.score : 0)).filter(Number.isFinite);
  const prosodyScores = prosody.map((item) => (typeof item.score === "number" ? item.score : 0)).filter(Number.isFinite);
  const issueCount = disfluency.reduce((count, item) => count + (Array.isArray(item.issues) ? item.issues.length : 0), 0);
  const triggerCount = lexical.reduce((count, item) => count + (Array.isArray(item.triggers) ? item.triggers.length : 0), 0);
  const focusList = asStringArray(reasoning.coaching_focus);
  const constraints = asStringArray(context.style_constraints);

  return [
    {
      node: "prepare_input",
      eyebrow: "input hygiene",
      title: String((audio.format as string | undefined) || "unknown audio").toUpperCase(),
      metric: `${segments.length} segments`,
      detail: `Source: ${truncate(String((audio.source_path as string | undefined) || "n/a"), 42)}`,
      accent: nodeAccentClasses.prepare_input,
    },
    {
      node: "asr",
      eyebrow: "speech capture",
      title: truncate(result.transcript || "No transcript", 48),
      metric: `${rawAsrSegments.length} raw chunks`,
      detail: `Language: ${String(meta.language || "unknown")} · Mode: ${String(meta.asr_mode || "n/a")}`,
      accent: nodeAccentClasses.asr,
    },
    {
      node: "segment",
      eyebrow: "segmentation",
      title: `${segments.length} speaking units`,
      metric: `${segments.reduce((sum, item) => sum + (item.token_count || 0), 0)} tokens`,
      detail: segments[0]?.text ? truncate(segments[0].text || "", 56) : "--",
      accent: nodeAccentClasses.segment,
    },
    {
      node: "lexical",
      eyebrow: "wording scan",
      title: `${triggerCount} lexical triggers`,
      metric: formatNumber(average(lexicalScores), 2),
      detail: lexical[0]?.triggers ? `Top triggers: ${asStringArray(lexical[0].triggers).join(", ")}` : "No lexical triggers detected.",
      accent: nodeAccentClasses.lexical,
    },
    {
      node: "prosody",
      eyebrow: "voice dynamics",
      title: `${prosody.length} prosody rows`,
      metric: formatNumber(average(prosodyScores), 2),
      detail: "Timing, rate and pause stability are rolled up here.",
      accent: nodeAccentClasses.prosody,
    },
    {
      node: "disfluency",
      eyebrow: "fluency repair",
      title: `${issueCount} issue markers`,
      metric: `${disfluency.length} evaluated`,
      detail: issueCount ? "Filled pauses and repair patterns were captured." : "No strong disfluency pattern found.",
      accent: nodeAccentClasses.disfluency,
    },
    {
      node: "context",
      eyebrow: "scenario lens",
      title: String(context.scenario || result.scenario),
      metric: `${constraints.length} constraints`,
      detail: constraints.length ? constraints.join(" / ") : "Using default context settings.",
      accent: nodeAccentClasses.context,
    },
    {
      node: "merge_analysis",
      eyebrow: "fusion layer",
      title: `${segments.length} merged segments`,
      metric: `${result.warnings.length} warnings`,
      detail: "Lexical, prosody, disfluency and context outputs were consolidated here.",
      accent: nodeAccentClasses.merge_analysis,
    },
    {
      node: "reasoning",
      eyebrow: "coach synthesis",
      title: truncate(String(resultPayload.summary || reasoning.llm_summary || "--"), 56),
      metric: `${asStringArray(resultPayload.dominant_causes).length} dominant causes`,
      detail: focusList.length ? `Focus: ${focusList.join(" · ")}` : "--",
      accent: nodeAccentClasses.reasoning,
    },
    {
      node: "feedback",
      eyebrow: "rewrite layer",
      title: `${feedback.length} feedback blocks`,
      metric: `${feedback.reduce((count, item) => count + (Array.isArray(item.practice_steps) ? item.practice_steps.length : 0), 0)} practice steps`,
      detail: feedback[0]?.rewrite ? truncate(String(feedback[0].rewrite), 56) : "--",
      accent: nodeAccentClasses.feedback,
    },
    {
      node: "serialize_result",
      eyebrow: "export status",
      title: String(resultPayload.status || result.status),
      metric: formatNumber(resultPayload.overall_score, 3),
      detail: `Level: ${String(resultPayload.level || "--")} · Errors: ${result.errors.length}`,
      accent: nodeAccentClasses.serialize_result,
    },
  ];
}

export function buildNodeDetails(
  node: NodeName,
  result: AnalysisStateResult | null,
  payload: Record<string, unknown> | null,
): NodeDetail {
  const snapshot = asRecord(payload?.node_snapshot) || asRecord(payload?.state) || (result ? nodeSnapshot(node, result) : null);
  const stateFromPayload = (asRecord(payload?.state) as AnalysisStateResult | null) || result;
  const current = stateFromPayload || result;
  const currentAgentOutputs = asRecord(current?.agent_outputs) || {};
  const currentMeta = asRecord(current?.meta) || {};

  if (!snapshot || !current) {
    return {
      title: prettifyNode(node),
      summary: "--",
      stats: [],
      bullets: [],
    };
  }

  if (node === "prepare_input") {
    const audio = asRecord(snapshot.audio) || {};
    return {
      title: "Audio normalization",
      summary: "Input audio metadata after path resolution and preprocessing bootstrap.",
      stats: [
        { label: "Format", value: String(audio.format || "n/a") },
        { label: "Duration", value: audio.duration_seconds ? `${audio.duration_seconds}s` : "n/a" },
        { label: "Sample rate", value: audio.sample_rate ? `${audio.sample_rate} Hz` : "n/a" },
        { label: "Channels", value: audio.channels ? String(audio.channels) : "n/a" },
      ],
      bullets: [
        `Source: ${String(audio.source_path || "n/a")}`,
        `Normalized: ${String(audio.normalized_path || "n/a")}`,
      ],
    };
  }

  if (node === "asr") {
    const transcript = String(snapshot.transcript || current.transcript || "");
    const rawSegments = Array.isArray(snapshot.raw_asr_segments)
      ? snapshot.raw_asr_segments
      : Array.isArray(current.raw_asr_segments)
        ? current.raw_asr_segments
        : [];
    return {
      title: "ASR transcript",
      summary: transcript || "--",
      stats: [
        { label: "Language", value: String(snapshot.language || currentMeta.language || "n/a") },
        { label: "Mode", value: String(snapshot.asr_mode || currentMeta.asr_mode || "n/a") },
        { label: "Chunks", value: String(rawSegments.length) },
      ],
      bullets: rawSegments.slice(0, 3).map((segment) => truncate(String((segment as SegmentLike).text || ""), 80)),
    };
  }

  if (node === "segment") {
    const segments = Array.isArray(snapshot.segments) ? (snapshot.segments as SegmentLike[]) : current.segments;
    return {
      title: "Segment map",
      summary: "Transcript sliced into presentation-friendly units.",
      stats: [
        { label: "Segments", value: String(segments.length) },
        { label: "Tokens", value: String(segments.reduce((sum, segment) => sum + (segment.token_count || 0), 0)) },
        { label: "Pauses tracked", value: String(segments.filter((segment) => segment.pause_before != null).length) },
      ],
      bullets: segments.slice(0, 4).map((segment) => `${segment.segment_id}: ${truncate(String(segment.text || ""), 86)}`),
    };
  }

  if (node === "lexical") {
    const lexical = Array.isArray(snapshot.lexical)
      ? snapshot.lexical
      : Array.isArray(currentAgentOutputs.lexical)
        ? currentAgentOutputs.lexical
        : [];
    return {
      title: "Lexical uncertainty",
      summary: "Flags hedging phrases, softened commitments and fuzzy wording.",
      stats: [
        { label: "Rows", value: String(lexical.length) },
        { label: "Triggers", value: String(lexical.reduce((sum, row) => sum + (Array.isArray(row.triggers) ? row.triggers.length : 0), 0)) },
        { label: "Avg score", value: formatNumber(average(lexical.map((row) => (typeof row.score === "number" ? row.score : 0))), 2) },
      ],
      bullets: lexical.flatMap((row) => asStringArray(row.triggers)).slice(0, 6),
    };
  }

  if (node === "prosody") {
    const prosody = Array.isArray(snapshot.prosody)
      ? snapshot.prosody
      : Array.isArray(currentAgentOutputs.prosody)
        ? currentAgentOutputs.prosody
        : [];
    const featureCards = prosody.flatMap((row) => Object.entries(asRecord(row.features) || {})).slice(0, 4);
    return {
      title: "Prosody tracking",
      summary: "Estimates speech-rate and pause stability without a heavy acoustic model.",
      stats: [
        { label: "Rows", value: String(prosody.length) },
        { label: "Avg score", value: formatNumber(average(prosody.map((row) => (typeof row.score === "number" ? row.score : 0))), 2) },
        { label: "Features", value: String(featureCards.length) },
      ],
      bullets: featureCards.map(([key, value]) => `${key}: ${typeof value === "number" ? value.toFixed(3) : String(value)}`),
    };
  }

  if (node === "disfluency") {
    const disfluency = Array.isArray(snapshot.disfluency)
      ? snapshot.disfluency
      : Array.isArray(currentAgentOutputs.disfluency)
        ? currentAgentOutputs.disfluency
        : [];
    const issues = disfluency.flatMap((row) => (Array.isArray(row.issues) ? row.issues : []));
    return {
      title: "Disfluency markers",
      summary: "Tracks filled pauses, repeats and repair signals.",
      stats: [
        { label: "Rows", value: String(disfluency.length) },
        { label: "Issues", value: String(issues.length) },
        { label: "Avg score", value: formatNumber(average(disfluency.map((row) => (typeof row.score === "number" ? row.score : 0))), 2) },
      ],
      bullets: issues.slice(0, 6).map((issue) => `${String(issue.type)} · ${String(issue.text)} ×${String(issue.count ?? 1)}`),
    };
  }

  if (node === "context") {
    const context = asRecord(snapshot.context) || asRecord(currentAgentOutputs.context) || {};
    const weights = Object.entries(asRecord(context.weights) || {});
    return {
      title: "Context weighting",
      summary: "Scenario-specific weights and style constraints steer the final score.",
      stats: [
        { label: "Scenario", value: String(context.scenario || current.scenario) },
        { label: "Weights", value: String(weights.length) },
        { label: "Constraints", value: String(asStringArray(context.style_constraints).length) },
      ],
      bullets: [
        ...weights.map(([key, value]) => `${key}: ${typeof value === "number" ? value.toFixed(2) : String(value)}`),
        ...asStringArray(context.style_constraints),
      ].slice(0, 8),
    };
  }

  if (node === "merge_analysis") {
    const segments = Array.isArray(snapshot.segments) ? (snapshot.segments as SegmentLike[]) : current.segments;
    return {
      title: "Merged segment scores",
      summary: "Branch outputs are folded into a single segment-level score sheet.",
      stats: [
        { label: "Segments", value: String(segments.length) },
        { label: "Warnings", value: String((Array.isArray(snapshot.warnings) ? snapshot.warnings : current.warnings).length) },
        { label: "Highlights", value: String(segments.reduce((sum, segment) => sum + ((segment.highlights || []).length || 0), 0)) },
      ],
      bullets: segments.slice(0, 4).map((segment) => {
        const scores = segment.scores || {};
        return `${segment.segment_id} · lexical ${formatNumber(scores.lexical, 2)} · prosody ${formatNumber(scores.prosody, 2)} · disfluency ${formatNumber(scores.disfluency, 2)}`;
      }),
    };
  }

  if (node === "reasoning") {
    const reasoning = asRecord(snapshot.reasoning) || asRecord(currentAgentOutputs.reasoning) || {};
    const resultPayload = asRecord(snapshot.result) || current.result;
    return {
      title: "Reasoning summary",
      summary: String(resultPayload.summary || reasoning.llm_summary || "--"),
      stats: [
        { label: "Overall score", value: formatNumber(resultPayload.overall_score, 3) },
        { label: "Level", value: String(resultPayload.level || "--") },
        { label: "Dominant causes", value: String(asStringArray(resultPayload.dominant_causes).length) },
      ],
      bullets: [...asStringArray(resultPayload.dominant_causes), ...asStringArray(reasoning.coaching_focus)].slice(0, 6),
    };
  }

  if (node === "feedback") {
    const feedback = Array.isArray(snapshot.feedback)
      ? snapshot.feedback
      : Array.isArray(currentAgentOutputs.feedback)
        ? currentAgentOutputs.feedback
        : [];
    return {
      title: "Feedback rewrites",
      summary: "Turns the structured analysis into coachable, segment-by-segment rewrites.",
      stats: [
        { label: "Rows", value: String(feedback.length) },
        { label: "Practice steps", value: String(feedback.reduce((sum, row) => sum + (Array.isArray(row.practice_steps) ? row.practice_steps.length : 0), 0)) },
        { label: "High severity", value: String(feedback.filter((row) => row.severity === "high").length) },
      ],
      bullets: feedback.slice(0, 4).map((row) => `${String(row.segment_id)} · ${truncate(String(row.rewrite || row.problem || ""), 88)}`),
    };
  }

  const resultPayload = asRecord(snapshot.result) || current.result;
  return {
    title: "Serialized runtime payload",
    summary: "Final JSON export is ready for downstream UI, storage or demo playback.",
    stats: [
      { label: "Status", value: String(resultPayload.status || current.status) },
      { label: "Warnings", value: String((Array.isArray(snapshot.warnings) ? snapshot.warnings : current.warnings).length) },
      { label: "Errors", value: String((Array.isArray(snapshot.errors) ? snapshot.errors : current.errors).length) },
    ],
    bullets: [
      `Summary: ${truncate(String(resultPayload.summary || "n/a"), 90)}`,
      `Dominant causes: ${asStringArray(resultPayload.dominant_causes).join(", ") || "n/a"}`,
      `Workflow nodes: ${getWorkflowNodes(current).join(" -> ")}`,
    ],
  };
}

export function getSelectedNodeSnapshot(
  node: NodeName,
  result: AnalysisStateResult | null,
  payload: Record<string, unknown> | null,
) {
  return asRecord(payload?.node_snapshot) || asRecord(payload?.state) || (result ? nodeSnapshot(node, result) : null);
}

export function buildResultSummary(finalState: AnalysisStateResult | null, job: AnalysisJob | null): ResultSummary {
  const resultPayload = asRecord(finalState?.result) || {};
  const feedbackRows = Array.isArray(finalState?.agent_outputs?.feedback) ? finalState.agent_outputs.feedback : [];
  const segmentResults = Array.isArray(resultPayload.segment_results) ? (resultPayload.segment_results as SegmentLike[]) : finalState?.segments || [];

  return {
    overallScore:
      typeof resultPayload.overall_score === "number"
        ? resultPayload.overall_score
        : typeof job?.overall_score === "number"
          ? job.overall_score
          : null,
    level: typeof resultPayload.level === "string" ? resultPayload.level : job?.level || null,
    summary: String(resultPayload.summary || job?.summary || "--"),
    dominantCauses: asStringArray(resultPayload.dominant_causes).length
      ? asStringArray(resultPayload.dominant_causes)
      : job?.dominant_causes || [],
    warnings: finalState?.warnings || job?.warnings || [],
    errors: finalState?.errors || (job?.error ? [job.error] : []),
    feedbackRows,
    segmentResults,
    transcript: finalState?.transcript || "",
    requestId: finalState?.request_id || job?.analysis_id || null,
    scenario: finalState?.scenario || job?.scenario || null,
  };
}

export function makeStat(label: string, value: string): KeyValueItem {
  return { label, value };
}
