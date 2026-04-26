import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { MetricBar } from "@/components/pipeline/MetricBar";
import {
  asRecord,
  asStringArray,
  formatNumber,
  formatSeconds,
  getSelectedNodeSnapshot,
} from "@/lib/analysis-helpers";
import type { AnalysisStateResult, NodeName, SegmentLike } from "@/types/analysis";

type NodeSpotlightProps = {
  node: NodeName;
  result: AnalysisStateResult | null;
  payload: Record<string, unknown> | null;
};

export function NodeSpotlight({ node, result, payload }: NodeSpotlightProps) {
  const snapshot = getSelectedNodeSnapshot(node, result, payload);
  const current = (asRecord(payload?.state) as AnalysisStateResult | null) || result;
  const currentMeta = asRecord(current?.meta) || {};
  const currentAgentOutputs = asRecord(current?.agent_outputs) || {};

  if (!snapshot || !current) {
    return <div className="text-sm text-muted-foreground">--</div>;
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
          <Tile key={label} label={label} value={value} />
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
          <div className="mt-3 text-sm leading-7">{String(snapshot.transcript || current.transcript || "--")}</div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Tile label="Language" value={String(snapshot.language || currentMeta.language || "unknown")} />
          <Tile label="ASR mode" value={String(snapshot.asr_mode || currentMeta.asr_mode || "n/a")} />
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
              <MetricBar label="lexical" value={segment.scores?.lexical} tone="from-rose-400 to-orange-300" />
              <MetricBar label="prosody" value={segment.scores?.prosody} tone="from-cyan-400 to-emerald-300" />
              <MetricBar label="disfluency" value={segment.scores?.disfluency} tone="from-red-400 to-rose-300" />
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
              <div className="mt-3">
                <MetricBar label="lexical score" value={row.score} tone="from-rose-400 to-orange-300" />
              </div>
              <div className="mt-3 text-sm leading-6 text-muted-foreground">{asStringArray(row.explanations).join(" · ") || "--"}</div>
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
            <div className="mt-3">
              <MetricBar label={feature.key} value={feature.value} tone="from-cyan-400 to-emerald-300" />
            </div>
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
            <div className="mt-3 text-sm leading-6 text-muted-foreground">{asStringArray(row.explanations).join(" · ") || "--"}</div>
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
            {weights.map(([key, value]) => (
              <MetricBar key={key} label={key} value={value} tone="from-violet-400 to-fuchsia-300" />
            ))}
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
          <div className="mt-3 text-sm leading-7">{String(resultPayload.summary || reasoning.llm_summary || "--")}</div>
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
          <MetricBar label="overall score" value={resultPayload.overall_score} tone="from-indigo-400 to-slate-300" />
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

type TileProps = {
  label: string;
  value: ReactNode;
};

function Tile({ label, value }: TileProps) {
  return (
    <div className="rounded-[20px] border bg-background/70 p-4">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm leading-6">{value}</div>
    </div>
  );
}
