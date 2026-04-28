import type { LucideIcon } from "lucide-react";
import {
  AudioLines,
  FileJson2,
  Layers3,
  Wand2,
} from "lucide-react";

export type JobStatus = "queued" | "running" | "completed" | "failed";
export type AppMode = "live" | "replay";
export type AppTab = "run" | "pipeline" | "results" | "debug";

export type AnalysisJob = {
  analysis_id: string;
  request_id?: string;
  trace_id?: string;
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

export type AnalysisEvent = {
  analysis_id: string;
  event_type: string;
  request_id?: string;
  trace_id?: string;
  status?: string | null;
  node?: string | null;
  step_index?: number | null;
  total_steps?: number | null;
  progress?: number | null;
  message?: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type SegmentLike = {
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

export type AnalysisStateResult = {
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
    evidence_summary: Record<string, unknown>;
    judgment: Record<string, unknown>;
    coaching: Record<string, unknown>;
    feedback: Array<Record<string, unknown>>;
  };
  result: Record<string, unknown>;
  warnings: string[];
  errors: string[];
  meta: Record<string, unknown>;
};

export type NodeName =
  | "input"
  | "evidence"
  | "coaching"
  | "finalize";

export type NodeVisual = {
  node: NodeName;
  eyebrow: string;
  title: string;
  metric: string;
  detail: string;
  accent: string;
};

export type KeyValueItem = {
  label: string;
  value: string;
};

export type NodeDetail = {
  title: string;
  summary: string;
  stats: KeyValueItem[];
  bullets: string[];
};

export type ResultSummary = {
  overallScore: number | null;
  level: string | null;
  summary: string;
  dominantCauses: string[];
  coachingFocus: string[];
  strengths: string[];
  warnings: string[];
  errors: string[];
  feedbackRows: Array<Record<string, unknown>>;
  segmentResults: SegmentLike[];
  transcript: string;
  requestId: string | null;
  scenario: string | null;
  coachingProvider: string | null;
  coachingModel: string | null;
};

export type ApiErrorResponse = {
  detail: string;
  code?: string;
  request_id?: string;
  trace_id?: string;
};

export type IssueTone = "warning" | "destructive";

export type RuntimeIssue = {
  message: string;
  tone: IssueTone;
  code?: string;
  requestId?: string;
  traceId?: string;
};

export const scenarioOptions = ["interview", "presentation", "academic", "business", "casual"];
export const defaultReplayPath = "/tmp/speaksure-one-round/en_test_0315.presentation.json";

export const pipelineOrder: NodeName[] = [
  "input",
  "evidence",
  "coaching",
  "finalize",
];

export const appTabs: Array<{
  id: AppTab;
  label: string;
  description: string;
  path: string;
}> = [
  {
    id: "run",
    label: "Run",
    description: "Configure live or replay sessions.",
    path: "/run",
  },
  {
    id: "pipeline",
    label: "Pipeline",
    description: "Track node progress and timing.",
    path: "/pipeline",
  },
  {
    id: "results",
    label: "Results",
    description: "Read the final coaching output.",
    path: "/results",
  },
  {
    id: "debug",
    label: "Debug",
    description: "Inspect raw payloads and runtime metadata.",
    path: "/debug",
  },
];

export const pipelineIcons: Record<NodeName, LucideIcon> = {
  input: AudioLines,
  evidence: Layers3,
  coaching: Wand2,
  finalize: FileJson2,
};

export const nodeAccentClasses: Record<NodeName, string> = {
  input: "from-orange-400/25 to-amber-300/10",
  evidence: "from-cyan-400/20 to-violet-300/10",
  coaching: "from-emerald-400/25 to-lime-300/10",
  finalize: "from-indigo-400/20 to-slate-300/10",
};
