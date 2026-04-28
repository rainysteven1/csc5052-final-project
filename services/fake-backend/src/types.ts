export type FakeTimelineStep = {
  eventType: string;
  status: string;
  node: string;
  progress: number;
  message: string;
  substep?: string;
};

export type FakeScenario = {
  id: string;
  label: string;
  audioFilename: string;
  resultFile: string;
  timeline: FakeTimelineStep[];
};

export type FakeCatalog = {
  defaultScenario: string;
  scenarios: FakeScenario[];
};

export type AnalysisJob = {
  analysis_id: string;
  request_id: string;
  trace_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  scenario: string;
  audio_filename: string;
  audio_path: string;
  transcript_override?: string | null;
  prompt_language?: string | null;
  upload_wandb: boolean;
  result_path?: string | null;
  error?: string | null;
  warnings: string[];
  overall_score?: number | null;
  risk_score?: number | null;
  level?: string | null;
  summary?: string | null;
  dominant_causes: string[];
  current_node?: string | null;
  completed_steps: number;
  total_steps: number;
  status_url: string;
  result_url: string;
  events_url: string;
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

export type JobRecord = {
  job: AnalysisJob;
  result: Record<string, unknown>;
  events: AnalysisEvent[];
  terminal: boolean;
  subscribers: Set<import('node:stream').Writable>;
};
