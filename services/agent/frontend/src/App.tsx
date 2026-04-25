import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  AudioLines,
  BookOpenText,
  FileJson2,
  Gauge,
  Layers3,
  Mic,
  Pause,
  Play,
  RadioTower,
  SkipBack,
  SkipForward,
  Sparkles,
  Wand2,
  Waves,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type JobStatus = "queued" | "running" | "completed" | "failed";
type AppMode = "live" | "replay";

type AnalysisJob = {
  analysis_id: string;
  status: JobStatus;
  scenario: string;
  audio_filename: string;
  audio_path: string;
  transcript_override?: string | null;
  upload_wandb: boolean;
  result_path?: string | null;
  error?: string | null;
  warnings: string[];
  overall_score?: number | null;
  level?: string | null;
  summary?: string | null;
  dominant_causes: string[];
  current_node?: string | null;
  completed_steps: number;
  total_steps: number;
  status_url?: string;
  result_url?: string;
  events_url?: string;
};

type AnalysisEvent = {
  analysis_id: string;
  event_type: string;
  status?: string | null;
  node?: string | null;
  step_index?: number | null;
  total_steps?: number | null;
  progress?: number | null;
  message?: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

type AnalysisStateResult = {
  request_id: string;
  status: string;
  scenario: string;
  audio: Record<string, unknown>;
  artifacts: Record<string, unknown>;
  transcript: string;
  raw_asr_segments: SegmentLike[];
  segments: SegmentLike[];
  agent_outputs: {
    lexical: Array<Record<string, unknown>>;
    prosody: Array<Record<string, unknown>>;
    disfluency: Array<Record<string, unknown>>;
    context: Record<string, unknown>;
    reasoning: Record<string, unknown>;
    feedback: Array<Record<string, unknown>>;
  };
  result: Record<string, unknown>;
  warnings: string[];
  errors: string[];
  meta: Record<string, unknown>;
};

type SegmentLike = {
  segment_id: string;
  start?: number;
  end?: number;
  text?: string;
  pause_before?: number | null;
  token_count?: number;
  scores?: Record<string, number | null>;
  highlights?: Array<Record<string, unknown>>;
  feedback?: Record<string, unknown>;
};

type NodeName =
  | "prepare_input"
  | "asr"
  | "segment"
  | "lexical"
  | "prosody"
  | "disfluency"
  | "context"
  | "merge_analysis"
  | "reasoning"
  | "feedback"
  | "serialize_result";

type NodeVisual = {
  node: NodeName;
  eyebrow: string;
  title: string;
  metric: string;
  detail: string;
  accent: string;
};

type KeyValueItem = {
  label: string;
  value: string;
};

type NodeDetail = {
  title: string;
  summary: string;
  stats: KeyValueItem[];
  bullets: string[];
};

const scenarioOptions = ["interview", "presentation", "academic", "business", "casual"];
const defaultReplayPath = "/tmp/speaksure-one-round/en_test_0315.presentation.json";
const pipelineOrder: NodeName[] = [
  "prepare_input",
  "asr",
  "segment",
  "lexical",
  "prosody",
  "disfluency",
  "context",
  "merge_analysis",
  "reasoning",
  "feedback",
  "serialize_result",
];

const pipelineIcons: Record<NodeName, typeof Mic> = {
  prepare_input: AudioLines,
  asr: Mic,
  segment: Waves,
  lexical: Activity,
  prosody: RadioTower,
  disfluency: AlertTriangle,
  context: Sparkles,
  merge_analysis: Layers3,
  reasoning: BookOpenText,
  feedback: Wand2,
  serialize_result: FileJson2,
};

const nodeAccentClasses: Record<NodeName, string> = {
  prepare_input: "from-orange-400/25 to-amber-300/10",
  asr: "from-teal-400/20 to-cyan-300/10",
  segment: "from-sky-400/20 to-indigo-300/10",
  lexical: "from-rose-400/20 to-orange-300/10",
  prosody: "from-cyan-400/20 to-emerald-300/10",
  disfluency: "from-red-400/20 to-rose-300/10",
  context: "from-violet-400/20 to-fuchsia-300/10",
  merge_analysis: "from-stone-400/20 to-zinc-300/10",
  reasoning: "from-amber-400/25 to-yellow-300/10",
  feedback: "from-emerald-400/25 to-lime-300/10",
  serialize_result: "from-indigo-400/20 to-slate-300/10",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function prettifyNode(node?: string | null) {
  return (node || "waiting").replace(/_/g, " ");
}

function statusTone(status?: string | null) {
  if (status === "completed") return "accent";
  if (status === "failed") return "destructive";
  if (status === "running") return "default";
  return "outline";
}

function truncate(text: string, limit = 72) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length <= limit ? compact : `${compact.slice(0, limit - 3)}...`;
}

function formatNumber(value: unknown, digits = 3) {
  return typeof value === "number" ? value.toFixed(digits) : "--";
}

function formatPercent(value: unknown) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "--";
}

function formatSeconds(value: unknown) {
  return typeof value === "number" ? `${value.toFixed(2)}s` : "n/a";
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function scoreToPercent(value: unknown) {
  return typeof value === "number" ? Math.max(0, Math.min(100, value * 100)) : 0;
}

function getWorkflowNodes(result: AnalysisStateResult | null) {
  const nodes = result?.meta?.workflow_nodes;
  return Array.isArray(nodes) && nodes.length ? nodes.map((item) => String(item)) : pipelineOrder;
}

function nodeSnapshot(node: NodeName, result: AnalysisStateResult): Record<string, unknown> {
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

function buildReplayEvents(result: AnalysisStateResult, replayPath: string): { job: AnalysisJob; events: AnalysisEvent[] } {
  const nodes = getWorkflowNodes(result) as NodeName[];
  const baseTime = Date.now();
  const audio = asRecord(result.audio);
  const sourcePath = typeof audio?.source_path === "string" ? audio.source_path : replayPath;
  const audioFilename = sourcePath.split("/").pop() || "replay.json";
  const overallScore = typeof result.result?.overall_score === "number" ? result.result.overall_score : null;
  const level = typeof result.result?.level === "string" ? result.result.level : null;
  const summary = typeof result.result?.summary === "string" ? result.result.summary : null;
  const dominantCauses = asStringArray(result.result?.dominant_causes);

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

function buildNodeVisuals(result: AnalysisStateResult | null): NodeVisual[] {
  if (!result) {
    return pipelineOrder.map((node) => ({
      node,
      eyebrow: prettifyNode(node),
      title: "Awaiting data",
      metric: "--",
      detail: "Run a live analysis or load a replay file.",
      accent: nodeAccentClasses[node],
    }));
  }

  const segments = result.segments || [];
  const rawAsrSegments = result.raw_asr_segments || [];
  const meta = asRecord(result.meta) || {};
  const agentOutputs = asRecord(result.agent_outputs) || {};
  const lexical = Array.isArray(agentOutputs.lexical) ? agentOutputs.lexical : [];
  const prosody = Array.isArray(agentOutputs.prosody) ? agentOutputs.prosody : [];
  const disfluency = Array.isArray(agentOutputs.disfluency) ? agentOutputs.disfluency : [];
  const feedback = Array.isArray(agentOutputs.feedback) ? agentOutputs.feedback : [];
  const context = asRecord(agentOutputs.context) || {};
  const reasoning = asRecord(agentOutputs.reasoning) || {};
  const resultPayload = asRecord(result.result) || {};
  const lexicalScores = lexical
    .map((item) => (typeof item.score === "number" ? item.score : 0))
    .filter((value) => Number.isFinite(value));
  const prosodyScores = prosody
    .map((item) => (typeof item.score === "number" ? item.score : 0))
    .filter((value) => Number.isFinite(value));
  const issueCount = disfluency.reduce((count, item) => count + (Array.isArray(item.issues) ? item.issues.length : 0), 0);
  const triggerCount = lexical.reduce((count, item) => count + (Array.isArray(item.triggers) ? item.triggers.length : 0), 0);
  const focusList = asStringArray(reasoning.coaching_focus);
  const constraints = asStringArray(context.style_constraints);

  return [
    {
      node: "prepare_input",
      eyebrow: "input hygiene",
      title: String((asRecord(result.audio)?.format as string | undefined) || "unknown audio").toUpperCase(),
      metric: `${segments.length} segments`,
      detail: `Source: ${truncate(String((asRecord(result.audio)?.source_path as string | undefined) || "n/a"), 42)}`,
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
      detail: segments[0]?.text ? truncate(segments[0].text || "", 56) : "No segment text available yet.",
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
      title: truncate(String(resultPayload.summary || reasoning.llm_summary || "No summary yet"), 56),
      metric: `${asStringArray(resultPayload.dominant_causes).length} dominant causes`,
      detail: focusList.length ? `Focus: ${focusList.join(" · ")}` : "No coaching focus list available yet.",
      accent: nodeAccentClasses.reasoning,
    },
    {
      node: "feedback",
      eyebrow: "rewrite layer",
      title: `${feedback.length} feedback blocks`,
      metric: `${feedback.reduce((count, item) => count + (Array.isArray(item.practice_steps) ? item.practice_steps.length : 0), 0)} practice steps`,
      detail: feedback[0]?.rewrite ? truncate(String(feedback[0].rewrite), 56) : "No rewrite suggestions yet.",
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

function buildNodeDetails(node: NodeName, result: AnalysisStateResult | null, payload: Record<string, unknown> | null) {
  const snapshot = asRecord(payload?.node_snapshot) || asRecord(payload?.state) || (result ? nodeSnapshot(node, result) : null);
  const stateFromPayload = (asRecord(payload?.state) as AnalysisStateResult | null) || result;
  const current = stateFromPayload || result;
  const currentAgentOutputs = asRecord(current?.agent_outputs) || {};
  const currentMeta = asRecord(current?.meta) || {};
  if (!snapshot || !current) {
    return {
      title: prettifyNode(node),
      summary: "No structured payload yet for this stage.",
      stats: [] as KeyValueItem[],
      bullets: [] as string[],
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
      summary: transcript || "No transcript captured yet.",
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
      summary: String(resultPayload.summary || reasoning.llm_summary || "No summary generated."),
      stats: [
        { label: "Overall score", value: formatNumber(resultPayload.overall_score, 3) },
        { label: "Level", value: String(resultPayload.level || "--") },
        { label: "Dominant causes", value: String(asStringArray(resultPayload.dominant_causes).length) },
      ],
      bullets: [
        ...asStringArray(resultPayload.dominant_causes),
        ...asStringArray(reasoning.coaching_focus),
      ].slice(0, 6),
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

function renderMetricBar(label: string, value: unknown, tone = "from-primary to-accent") {
  const percent = scoreToPercent(value);
  return (
    <div key={label} className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="uppercase tracking-[0.18em]">{label}</span>
        <span>{typeof value === "number" ? value.toFixed(2) : String(value ?? "--")}</span>
      </div>
      <div className="h-2 rounded-full bg-secondary">
        <div className={cn("h-2 rounded-full bg-gradient-to-r", tone)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function renderNodeSpotlight(node: NodeName, result: AnalysisStateResult | null, payload: Record<string, unknown> | null): ReactNode {
  const snapshot = asRecord(payload?.node_snapshot) || asRecord(payload?.state) || (result ? nodeSnapshot(node, result) : null);
  const current = (asRecord(payload?.state) as AnalysisStateResult | null) || result;
  const currentMeta = asRecord(current?.meta) || {};
  const currentAgentOutputs = asRecord(current?.agent_outputs) || {};
  if (!snapshot || !current) {
    return <div className="text-sm text-muted-foreground">No rich visualization yet. Start a run or load a replay.</div>;
  }

  if (node === "prepare_input") {
    const audio = asRecord(snapshot.audio) || {};
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["Source", String(audio.source_path || "n/a")],
          ["Normalized", String(audio.normalized_path || "n/a")],
          ["Format", String(audio.format || "n/a")],
          ["Duration", formatSeconds(audio.duration_seconds)],
          ["Sample rate", audio.sample_rate ? `${audio.sample_rate} Hz` : "n/a"],
          ["Channels", audio.channels ? String(audio.channels) : "n/a"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[20px] border bg-background/70 p-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
            <div className="mt-2 text-sm leading-6">{value}</div>
          </div>
        ))}
      </div>
    );
  }

  if (node === "asr") {
    const rawSegments = Array.isArray(snapshot.raw_asr_segments)
      ? snapshot.raw_asr_segments
      : Array.isArray(current.raw_asr_segments)
        ? current.raw_asr_segments
        : [];
    return (
      <div className="space-y-4">
        <div className="rounded-[24px] border bg-background/70 p-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Transcript</div>
          <div className="mt-3 text-sm leading-7">{String(snapshot.transcript || current.transcript || "No transcript captured.")}</div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[20px] border bg-background/70 p-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Language</div>
            <div className="mt-2 text-sm">{String(snapshot.language || currentMeta.language || "unknown")}</div>
          </div>
          <div className="rounded-[20px] border bg-background/70 p-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">ASR mode</div>
            <div className="mt-2 text-sm">{String(snapshot.asr_mode || currentMeta.asr_mode || "n/a")}</div>
          </div>
        </div>
        <div className="space-y-3">
          {rawSegments.slice(0, 4).map((segment) => (
            <div key={String((segment as SegmentLike).segment_id)} className="rounded-[20px] border bg-background/70 p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{String((segment as SegmentLike).segment_id)}</span>
                <span>
                  {formatSeconds((segment as SegmentLike).start)} - {formatSeconds((segment as SegmentLike).end)}
                </span>
              </div>
              <div className="mt-2 text-sm leading-6">{String((segment as SegmentLike).text || "")}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (node === "segment" || node === "merge_analysis") {
    const segments = Array.isArray(snapshot.segments) ? (snapshot.segments as SegmentLike[]) : current.segments;
    return (
      <div className="space-y-3">
        {segments.slice(0, 6).map((segment) => (
          <div key={segment.segment_id} className="rounded-[22px] border bg-background/70 p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">{segment.segment_id}</div>
              <div className="text-xs text-muted-foreground">
                {formatSeconds(segment.start)} - {formatSeconds(segment.end)}
              </div>
            </div>
            <div className="mt-2 text-sm leading-6">{String(segment.text || "")}</div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {renderMetricBar("lexical", segment.scores?.lexical, "from-rose-400 to-orange-300")}
              {renderMetricBar("prosody", segment.scores?.prosody, "from-cyan-400 to-emerald-300")}
              {renderMetricBar("disfluency", segment.scores?.disfluency, "from-red-400 to-rose-300")}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (node === "lexical") {
    const lexical = Array.isArray(snapshot.lexical)
      ? snapshot.lexical
      : Array.isArray(currentAgentOutputs.lexical)
        ? currentAgentOutputs.lexical
        : [];
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {lexical.flatMap((row) => asStringArray(row.triggers)).slice(0, 16).map((trigger) => (
            <Badge key={trigger} variant="outline" className="bg-white/70">
              {trigger}
            </Badge>
          ))}
        </div>
        <div className="space-y-3">
          {lexical.slice(0, 4).map((row) => (
            <div key={String(row.segment_id)} className="rounded-[22px] border bg-background/70 p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">{String(row.segment_id)}</div>
                <div className="text-sm text-muted-foreground">score {formatNumber(row.score, 2)}</div>
              </div>
              <div className="mt-3">{renderMetricBar("lexical score", row.score, "from-rose-400 to-orange-300")}</div>
              <div className="mt-3 text-sm leading-6 text-muted-foreground">
                {asStringArray(row.explanations).join(" · ") || "No explanation text available."}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (node === "prosody") {
    const prosody = Array.isArray(snapshot.prosody)
      ? snapshot.prosody
      : Array.isArray(currentAgentOutputs.prosody)
        ? currentAgentOutputs.prosody
        : [];
    const features = prosody.flatMap((row) =>
      Object.entries(asRecord(row.features) || {}).map(([key, value]) => ({
        segmentId: String(row.segment_id),
        key,
        value: typeof value === "number" ? value : 0,
      })),
    );
    return (
      <div className="space-y-3">
        {features.slice(0, 8).map((feature) => (
          <div key={`${feature.segmentId}-${feature.key}`} className="rounded-[20px] border bg-background/70 p-4">
            <div className="flex items-center justify-between text-sm">
              <span>{feature.segmentId}</span>
              <span className="text-muted-foreground">{feature.key}</span>
            </div>
            <div className="mt-3">{renderMetricBar(feature.key, feature.value, "from-cyan-400 to-emerald-300")}</div>
          </div>
        ))}
      </div>
    );
  }

  if (node === "disfluency") {
    const disfluency = Array.isArray(snapshot.disfluency)
      ? snapshot.disfluency
      : Array.isArray(currentAgentOutputs.disfluency)
        ? currentAgentOutputs.disfluency
        : [];
    return (
      <div className="space-y-3">
        {disfluency.slice(0, 4).map((row) => (
          <div key={String(row.segment_id)} className="rounded-[22px] border bg-background/70 p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">{String(row.segment_id)}</div>
              <div className="text-sm text-muted-foreground">score {formatNumber(row.score, 2)}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(Array.isArray(row.issues) ? row.issues : []).map((issue: Record<string, unknown>, index: number) => (
                <Badge key={`${row.segment_id}-${index}`} variant="outline" className="bg-white/70">
                  {String(issue.type)} · {String(issue.text)}
                </Badge>
              ))}
            </div>
            <div className="mt-3 text-sm leading-6 text-muted-foreground">
              {asStringArray(row.explanations).join(" · ") || "No disfluency explanation provided."}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (node === "context") {
    const context = asRecord(snapshot.context) || asRecord(currentAgentOutputs.context) || {};
    const weights = Object.entries(asRecord(context.weights) || {});
    return (
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[24px] border bg-background/70 p-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Weights</div>
          <div className="mt-4 space-y-4">
            {weights.map(([key, value]) => renderMetricBar(key, value, "from-violet-400 to-fuchsia-300"))}
          </div>
        </div>
        <div className="rounded-[24px] border bg-background/70 p-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Style constraints</div>
          <div className="mt-4 space-y-2">
            {asStringArray(context.style_constraints).map((item) => (
              <div key={item} className="rounded-2xl bg-secondary/50 px-3 py-2 text-sm leading-6">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (node === "reasoning") {
    const reasoning = asRecord(snapshot.reasoning) || asRecord(currentAgentOutputs.reasoning) || {};
    const resultPayload = asRecord(snapshot.result) || current.result;
    return (
      <div className="space-y-4">
        <div className="rounded-[24px] border bg-background/70 p-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Narrative summary</div>
          <div className="mt-3 text-sm leading-7">{String(resultPayload.summary || reasoning.llm_summary || "No summary yet.")}</div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border bg-background/70 p-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Dominant causes</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {asStringArray(resultPayload.dominant_causes).map((item) => (
                <Badge key={item} variant="outline" className="bg-white/70">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] border bg-background/70 p-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Coaching focus</div>
            <div className="mt-3 space-y-2">
              {asStringArray(reasoning.coaching_focus).map((item) => (
                <div key={item} className="rounded-2xl bg-secondary/50 px-3 py-2 text-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (node === "feedback") {
    const feedback = Array.isArray(snapshot.feedback)
      ? snapshot.feedback
      : Array.isArray(currentAgentOutputs.feedback)
        ? currentAgentOutputs.feedback
        : [];
    return (
      <div className="space-y-4">
        {feedback.slice(0, 4).map((row) => (
          <div key={String(row.segment_id)} className="rounded-[24px] border bg-background/70 p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">{String(row.segment_id)}</div>
              <Badge variant={row.severity === "high" ? "destructive" : row.severity === "stable" ? "accent" : "outline"}>
                {String(row.severity || "unknown")}
              </Badge>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-[20px] bg-secondary/45 p-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Problem</div>
                <div className="mt-2 text-sm leading-6">{String(row.problem || row.reason || "n/a")}</div>
              </div>
              <div className="rounded-[20px] bg-accent/10 p-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Rewrite</div>
                <div className="mt-2 text-sm leading-6">{String(row.rewrite || "n/a")}</div>
              </div>
            </div>
            <div className="mt-3 text-sm leading-6">
              <span className="font-medium">Practice:</span> {String(row.practice || "n/a")}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {asStringArray(row.practice_steps).map((item) => (
                <Badge key={`${row.segment_id}-${item}`} variant="outline" className="bg-white/70">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const resultPayload = asRecord(snapshot.result) || current.result;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-[24px] border bg-background/70 p-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Final status</div>
        <div className="mt-3 font-display text-3xl">{String(resultPayload.status || current.status)}</div>
        <div className="mt-3 space-y-3">
          {renderMetricBar("overall score", resultPayload.overall_score, "from-indigo-400 to-slate-300")}
          <div className="text-sm text-muted-foreground">Level: {String(resultPayload.level || "--")}</div>
        </div>
      </div>
      <div className="rounded-[24px] border bg-background/70 p-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Runtime meta</div>
        <div className="mt-3 space-y-2 text-sm leading-6">
          <div>Warnings: {current.warnings.length}</div>
          <div>Errors: {current.errors.length}</div>
          <div>Engine: {String(currentMeta.workflow_engine || "n/a")}</div>
          <div>LLM reasoning: {String((asRecord(currentMeta.llm_reasoning)?.model as string | undefined) || "n/a")}</div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [mode, setMode] = useState<AppMode>("live");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [scenario, setScenario] = useState("presentation");
  const [transcriptOverride, setTranscriptOverride] = useState("");
  const [replayPath, setReplayPath] = useState(defaultReplayPath);
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [events, setEvents] = useState<AnalysisEvent[]>([]);
  const [activeNode, setActiveNode] = useState<NodeName>("prepare_input");
  const [activePayload, setActivePayload] = useState<Record<string, unknown> | null>(null);
  const [finalState, setFinalState] = useState<AnalysisStateResult | null>(null);
  const [replayCursor, setReplayCursor] = useState(0);
  const [isReplayPlaying, setIsReplayPlaying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const progressPercent = useMemo(() => {
    const latest = events.length ? events[events.length - 1] : undefined;
    if (latest?.progress != null) {
      return latest.progress * 100;
    }
    if (job?.total_steps) {
      return (job.completed_steps / job.total_steps) * 100;
    }
    return 0;
  }, [events, job]);

  const timeline = useMemo(() => [...events].reverse(), [events]);
  const nodeVisuals = useMemo(() => buildNodeVisuals(finalState), [finalState]);
  const selectedNodeDetail = useMemo(() => buildNodeDetails(activeNode, finalState, activePayload), [activeNode, finalState, activePayload]);
  const replayCurrentEvent = mode === "replay" ? events[replayCursor] : null;

  const applyReplayEvent = (event: AnalysisEvent | undefined) => {
    if (!event) {
      return;
    }
    setActiveNode((event.node as NodeName) || "prepare_input");
    setActivePayload(event.payload);
    const replayJob = event.payload?.job as AnalysisJob | undefined;
    if (replayJob) {
      setJob(replayJob);
    }
  };

  const resetSession = (nextMode: AppMode) => {
    eventSourceRef.current?.close();
    setMode(nextMode);
    setEvents([]);
    setJob(null);
    setFinalState(null);
    setActivePayload(null);
    setActiveNode("prepare_input");
    setReplayCursor(0);
    setIsReplayPlaying(false);
    setError(null);
  };

  useEffect(() => {
    if (mode !== "replay") {
      return;
    }
    applyReplayEvent(events[replayCursor]);
  }, [events, mode, replayCursor]);

  useEffect(() => {
    if (mode !== "replay" || !isReplayPlaying || events.length === 0) {
      return;
    }
    if (replayCursor >= events.length - 1) {
      setIsReplayPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setReplayCursor((current) => Math.min(current + 1, events.length - 1));
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [events.length, isReplayPlaying, mode, replayCursor]);

  const connectToEvents = (nextJob: AnalysisJob) => {
    if (!nextJob.events_url) {
      setError("Missing events URL for live run.");
      return;
    }
    eventSourceRef.current?.close();
    const source = new EventSource(nextJob.events_url);
    const handleEvent = (rawEvent: MessageEvent<string>) => {
      const parsed = JSON.parse(rawEvent.data) as AnalysisEvent;
      setEvents((current) => [...current, parsed]);
      setActiveNode((parsed.node as NodeName) || "prepare_input");
      setActivePayload(parsed.payload ?? null);

      const incomingJob = parsed.payload?.job as AnalysisJob | undefined;
      if (incomingJob) {
        setJob(incomingJob);
      }
      const result = asRecord(parsed.payload?.result) as AnalysisStateResult | null;
      const state = asRecord(parsed.payload?.state) as AnalysisStateResult | null;
      if (result) {
        setFinalState(result);
      } else if (state) {
        setFinalState((current) => current || state);
      }

      if (parsed.event_type === "analysis_completed" || parsed.event_type === "analysis_failed") {
        source.close();
      }
    };
    [
      "job_created",
      "job_running",
      "workflow_started",
      "workflow_finished",
      "node_started",
      "node_completed",
      "node_failed",
      "analysis_completed",
      "analysis_failed",
    ].forEach((eventName) => source.addEventListener(eventName, handleEvent as EventListener));
    source.onerror = () => {
      setError("SSE connection dropped. Check whether the backend is still running.");
      source.close();
    };
    eventSourceRef.current = source;
  };

  const handleSubmit = async () => {
    if (!audioFile) {
      setError("Please select an audio file first.");
      return;
    }

    resetSession("live");
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("audio", audioFile);
    formData.append("scenario", scenario);
    if (transcriptOverride.trim()) {
      formData.append("transcript_override", transcriptOverride.trim());
    }

    try {
      const response = await fetch("/api/v1/analyses", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const nextJob = (await response.json()) as AnalysisJob;
      setJob(nextJob);
      setActiveNode((nextJob.current_node as NodeName) || "prepare_input");
      connectToEvents(nextJob);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplayLoad = async () => {
    resetSession("replay");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/replays/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: replayPath }),
      });
      if (!response.ok) {
        throw new Error(`Replay request failed: ${response.status}`);
      }

      const payload = (await response.json()) as { path: string; result: AnalysisStateResult };
      const replay = buildReplayEvents(payload.result, payload.path);
      setFinalState(payload.result);
      setEvents(replay.events);
      setReplayCursor(0);
      setIsReplayPlaying(false);
      applyReplayEvent(replay.events[0]);
    } catch (replayError) {
      setError(replayError instanceof Error ? replayError.message : "Unknown replay error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[36px] border border-white/60 bg-hero-glow p-6 shadow-panel md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-3">
              <Badge variant="accent" className="w-fit">
                Live + Replay Console
              </Badge>
              <h1 className="font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                Watch each agent node work, or replay a saved result like a demo tape.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                This UI now supports real-time SSE progress and static JSON playback from files such as
                <span className="ml-1 rounded bg-white/70 px-2 py-1 font-mono text-xs text-foreground">
                  /tmp/speaksure-one-round/en_test_0315.presentation.json
                </span>
                .
              </p>
            </div>
            <div className="grid gap-3 rounded-[28px] border border-white/70 bg-white/70 p-4 backdrop-blur">
              <div className="text-sm text-muted-foreground">Session mode</div>
              <div className="flex gap-2">
                <Button variant={mode === "live" ? "default" : "secondary"} onClick={() => resetSession("live")}>
                  Live SSE
                </Button>
                <Button variant={mode === "replay" ? "default" : "secondary"} onClick={() => resetSession("replay")}>
                  Static Replay
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid items-start gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="flex h-[620px] min-h-0 flex-col xl:sticky xl:top-6">
            <CardHeader>
              <CardTitle>{mode === "live" ? "Start a live run" : "Load a replay file"}</CardTitle>
              <CardDescription>
                {mode === "live"
                  ? "Upload audio, stream node-by-node progress over SSE, and inspect payloads live."
                  : "Point the backend at an existing result JSON and reconstruct the pipeline view instantly."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-5">
              <ScrollArea className="min-h-0 flex-1 pr-2">
                <div className="grid gap-5 pb-1">
                  {mode === "live" ? (
                    <div className="grid gap-5">
                      <div className="space-y-2">
                        <Label htmlFor="audio">Audio file</Label>
                        <Input
                          id="audio"
                          type="file"
                          accept=".wav,.mp3,.m4a,.flac"
                          onChange={(event) => setAudioFile(event.target.files?.[0] || null)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="scenario">Scenario</Label>
                        <select
                          id="scenario"
                          value={scenario}
                          onChange={(event) => setScenario(event.target.value)}
                          className="flex h-11 w-full rounded-2xl border border-border bg-background/70 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {scenarioOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="transcript">Transcript override</Label>
                        <Textarea
                          id="transcript"
                          value={transcriptOverride}
                          onChange={(event) => setTranscriptOverride(event.target.value)}
                          placeholder="Optional: paste transcript text to bypass ASR."
                        />
                      </div>

                      <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? "Submitting..." : "Launch live analysis"}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-5">
                      <div className="space-y-2">
                        <Label htmlFor="replay-path">Replay JSON path</Label>
                        <Input
                          id="replay-path"
                          value={replayPath}
                          onChange={(event) => setReplayPath(event.target.value)}
                          placeholder="/tmp/speaksure-one-round/en_test_0315.presentation.json"
                        />
                      </div>
                      <Button className="w-full" size="lg" onClick={handleReplayLoad} disabled={isSubmitting}>
                        {isSubmitting ? "Loading replay..." : "Load static replay"}
                      </Button>
                      <div className="rounded-[24px] border border-dashed bg-background/60 p-4 text-sm text-muted-foreground">
                        The backend reads the JSON file from disk, validates it as an analysis state, then the frontend
                        synthesizes a timeline so you can inspect each node like a recorded session.
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="shrink-0 h-[52px]">
                {error ? (
                  <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
                ) : (
                  <div className="h-full rounded-2xl border border-dashed border-border/70 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                    {mode === "live"
                      ? "Submit one clip to lock the live session panel."
                      : "Load one saved JSON file to enter replay mode."}
                  </div>
                )}
              </div>

              <div className="shrink-0 h-[170px]">
                {job ? (
                  <div className="h-full rounded-[28px] border bg-secondary/40 p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Session</span>
                      <Badge variant={statusTone(job.status) as "default"}>{job.status}</Badge>
                    </div>
                    <div className="mt-2 break-all font-medium">{job.analysis_id}</div>
                    <div className="mt-4 grid gap-2 text-muted-foreground">
                      <div>Audio: {job.audio_filename}</div>
                      <div>Scenario: {job.scenario}</div>
                      <div>Current node: {prettifyNode(job.current_node || activeNode)}</div>
                      <div>
                        Steps: {job.completed_steps} / {job.total_steps}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-[28px] border border-dashed bg-background/40 p-4 text-center text-sm text-muted-foreground">
                    Session details stay pinned here once a live run or replay is loaded.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid min-w-0 gap-6">
            <Card className="flex min-h-0 flex-col">
              <CardHeader className="shrink-0 gap-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>Pipeline progress</CardTitle>
                    <CardDescription>
                      Active stage: <span className="font-medium text-foreground">{prettifyNode(activeNode)}</span>
                    </CardDescription>
                  </div>
                  <Badge variant={statusTone(job?.status) as "default"} className="w-fit">
                    {mode === "live" ? job?.status || "idle" : "replay"}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Progress value={progressPercent} />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{Math.round(progressPercent)}% complete</span>
                    <span>
                      {job?.completed_steps || 0}/{job?.total_steps || pipelineOrder.length} nodes finished
                    </span>
                  </div>
                </div>
                <div className="h-[86px]">
                  {mode === "replay" && events.length > 0 ? (
                    <div className="flex h-full flex-col gap-3 rounded-[24px] border bg-background/70 p-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Replay controls</div>
                        <div className="mt-2 truncate text-sm text-muted-foreground">
                          Frame {replayCursor + 1} / {events.length} · {replayCurrentEvent?.message || "Ready"}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setIsReplayPlaying(false);
                            setReplayCursor(0);
                          }}
                        >
                          <SkipBack className="mr-1 h-4 w-4" />
                          First
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setIsReplayPlaying(false);
                            setReplayCursor((current) => Math.max(current - 1, 0));
                          }}
                        >
                          <SkipBack className="mr-1 h-4 w-4" />
                          Prev
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (replayCursor >= events.length - 1) {
                              setReplayCursor(0);
                            }
                            setIsReplayPlaying((current) => !current);
                          }}
                        >
                          {isReplayPlaying ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
                          {isReplayPlaying ? "Pause" : "Play"}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setIsReplayPlaying(false);
                            setReplayCursor((current) => Math.min(current + 1, events.length - 1));
                          }}
                        >
                          Next
                          <SkipForward className="ml-1 h-4 w-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setIsReplayPlaying(false);
                            setReplayCursor(events.length - 1);
                          }}
                        >
                          Last
                          <SkipForward className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full items-center rounded-[24px] border border-dashed bg-background/40 px-4 text-sm text-muted-foreground">
                      Replay controls stay pinned here and will activate after a replay file is loaded.
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="min-w-0">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {pipelineOrder.map((node, index) => {
                    const Icon = pipelineIcons[node];
                    const isDone = (job?.completed_steps || 0) >= index + 1;
                    const isActive = activeNode === node;
                    const visual = nodeVisuals.find((item) => item.node === node);

                    return (
                      <button
                        key={node}
                        type="button"
                        onClick={() => {
                          setActiveNode(node);
                          const matchedIndex = events.findIndex((event) => event.node === node);
                          const matchedEvent = matchedIndex >= 0 ? events[matchedIndex] : undefined;
                          if (mode === "replay" && matchedIndex >= 0) {
                            setReplayCursor(matchedIndex);
                            setIsReplayPlaying(false);
                          }
                          setActivePayload(matchedEvent?.payload || (finalState ? { node_snapshot: nodeSnapshot(node, finalState) } : null));
                        }}
                        className={cn(
                          "relative h-[220px] overflow-hidden rounded-[24px] border p-4 text-left transition-all",
                          "hover:-translate-y-0.5 hover:shadow-panel",
                          isActive && "border-primary ring-2 ring-primary/25",
                          isDone && !isActive && "border-accent/40",
                          !isDone && !isActive && "border-border/70",
                        )}
                      >
                        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-90", visual?.accent)} />
                        <div className="relative flex h-full flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <div className={cn("rounded-2xl p-2", isDone ? "bg-accent text-accent-foreground" : "bg-white/70")}>
                              <Icon className={cn("h-4 w-4", isActive && mode === "live" && job?.status === "running" && "animate-spin")} />
                            </div>
                            <Badge variant={isDone ? "accent" : "outline"}>{index + 1}</Badge>
                          </div>
                          <div className="flex min-h-0 flex-1 flex-col">
                            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{visual?.eyebrow}</div>
                            <div className="mt-2 line-clamp-2 min-h-[3.5rem] font-display text-lg">{visual?.title}</div>
                            <div className="mt-2 text-sm font-medium">{visual?.metric}</div>
                            <div className="mt-2 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-muted-foreground">{visual?.detail}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <Card className="flex h-[500px] min-h-0 flex-col">
                <CardHeader className="shrink-0">
                  <CardTitle>{mode === "live" ? "Event stream" : "Replay timeline"}</CardTitle>
                  <CardDescription>
                    {mode === "live"
                      ? "Every SSE event lands here with timestamped node progress."
                      : "Synthetic timeline generated from the saved JSON so you can inspect it node by node."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="min-h-0 flex-1">
                  <ScrollArea className="h-[410px] pr-4">
                    <div className="space-y-3">
                      {timeline.length === 0 ? (
                        <div className="rounded-[24px] border border-dashed p-6 text-sm text-muted-foreground">
                          {mode === "live" ? "Submit an audio clip to start the timeline." : "Load a replay JSON to reconstruct the timeline."}
                        </div>
                      ) : (
                        timeline.map((event) => {
                          const isSelected =
                            mode === "replay"
                              ? replayCurrentEvent?.created_at === event.created_at &&
                                replayCurrentEvent?.event_type === event.event_type &&
                                replayCurrentEvent?.node === event.node
                              : activePayload === event.payload;
                          return (
                          <button
                            key={`${event.created_at}-${event.event_type}-${event.node}`}
                            type="button"
                            onClick={() => {
                              const eventIndex = events.findIndex(
                                (candidate) =>
                                  candidate.created_at === event.created_at &&
                                  candidate.event_type === event.event_type &&
                                  candidate.node === event.node,
                              );
                              if (mode === "replay" && eventIndex >= 0) {
                                setReplayCursor(eventIndex);
                                setIsReplayPlaying(false);
                              } else {
                                setActiveNode((event.node as NodeName) || "prepare_input");
                                setActivePayload(event.payload);
                              }
                            }}
                            className={cn(
                              "w-full rounded-[24px] border bg-background/70 p-4 text-left transition-colors hover:bg-background",
                              isSelected && "border-primary",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium">{event.message || event.event_type}</div>
                                <div className="text-xs text-muted-foreground">
                                  {formatTime(event.created_at)} · {prettifyNode(event.node)} · {Math.round((event.progress || 0) * 100)}%
                                </div>
                              </div>
                              <Badge variant={statusTone(event.status) as "default"}>{event.event_type}</Badge>
                            </div>
                          </button>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="flex h-[500px] min-h-0 flex-col">
                <CardHeader className="shrink-0">
                  <CardTitle>{selectedNodeDetail.title}</CardTitle>
                  <CardDescription>{selectedNodeDetail.summary}</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
                  <div className="grid shrink-0 gap-3 sm:grid-cols-2">
                    {selectedNodeDetail.stats.map((item) => (
                      <div key={item.label} className="rounded-[22px] border bg-background/70 p-4">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{item.label}</div>
                        <div className="mt-2 font-display text-2xl">{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-[24px] border bg-background/70 p-4">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Stage takeaways</div>
                    <ScrollArea className="mt-3 h-[86px] pr-3">
                      <div className="space-y-2 text-sm leading-6">
                        {selectedNodeDetail.bullets.length ? (
                          selectedNodeDetail.bullets.map((item) => (
                            <div key={item} className="rounded-2xl bg-secondary/50 px-3 py-2">
                              {item}
                            </div>
                          ))
                        ) : (
                          <div className="text-muted-foreground">No structured takeaways captured for this stage yet.</div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                  <div className="min-h-0 flex-1 rounded-[24px] border bg-background/70 p-4">
                    <div className="mb-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Visual spotlight</div>
                    <ScrollArea className="h-[170px] pr-3">
                      {renderNodeSpotlight(activeNode, finalState, activePayload)}
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <Card className="flex h-[420px] min-h-0 flex-col">
                <CardHeader className="shrink-0">
                  <CardTitle>Final output digest</CardTitle>
                  <CardDescription>Summary, score and dominant causes from the resolved analysis state.</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
                  <div className="grid shrink-0 gap-3 sm:grid-cols-3">
                    <div className="rounded-[24px] bg-secondary/45 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Score</div>
                      <div className="mt-2 font-display text-3xl">
                        {typeof job?.overall_score === "number" ? job.overall_score.toFixed(3) : "--"}
                      </div>
                    </div>
                    <div className="rounded-[24px] bg-secondary/45 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Level</div>
                      <div className="mt-2 font-display text-3xl">{job?.level || "--"}</div>
                    </div>
                    <div className="rounded-[24px] bg-secondary/45 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Warnings</div>
                      <div className="mt-2 font-display text-3xl">{job?.warnings.length || 0}</div>
                    </div>
                  </div>
                  <div className="rounded-[28px] border bg-background/70 p-5">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Summary</div>
                    <div className="mt-3 line-clamp-4 min-h-[7rem] text-sm leading-7">{job?.summary || "No final summary yet."}</div>
                  </div>
                  <ScrollArea className="min-h-0 flex-1 pr-2">
                    <div className="flex flex-wrap gap-2">
                      {(job?.dominant_causes || []).length > 0 ? (
                        job?.dominant_causes.map((cause) => (
                          <Badge key={cause} variant="outline" className="capitalize">
                            <Gauge className="mr-1 h-3 w-3" />
                            {cause}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Dominant causes will appear here.</span>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="flex h-[420px] min-h-0 flex-col">
                <CardHeader className="shrink-0">
                  <CardTitle>Rendered result JSON</CardTitle>
                  <CardDescription>Use this raw payload view when the node cards are not enough.</CardDescription>
                </CardHeader>
                <CardContent className="min-h-0 flex-1">
                  <ScrollArea className="h-[330px] rounded-[24px] border bg-stone-950 p-4 text-stone-100">
                    <pre className="text-xs leading-6">
                      {JSON.stringify(finalState || activePayload || { hint: "Awaiting analysis data." }, null, 2)}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <Card className="flex h-[360px] min-h-0 flex-col">
              <CardHeader className="shrink-0">
                <CardTitle>Raw event payload</CardTitle>
                <CardDescription>
                  This is the exact payload tied to the currently selected timeline item or node card.
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1">
                <ScrollArea className="h-[270px] rounded-[24px] border bg-stone-950 p-4 text-stone-100">
                  <pre className="text-xs leading-6">{JSON.stringify(activePayload || { hint: "No event payload yet." }, null, 2)}</pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
