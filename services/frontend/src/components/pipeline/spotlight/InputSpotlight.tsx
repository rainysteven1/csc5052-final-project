import { PipelineSectionBlock } from "@/components/pipeline/PipelineSectionBlock";
import { formatSeconds, sanitizeDisplayText } from "@/lib/analysis-helpers";
import type { AnalysisStateResult, SegmentLike } from "@/types/analysis";

import { SpotlightTile } from "@/components/pipeline/spotlight/SpotlightPrimitives";

type InputSpotlightProps = {
  snapshot: Record<string, unknown>;
  current: AnalysisStateResult;
  currentMeta: Record<string, unknown>;
};

export function InputSpotlight({ snapshot, current, currentMeta }: InputSpotlightProps) {
  const audio =
    typeof snapshot.audio === "object" && snapshot.audio !== null && !Array.isArray(snapshot.audio)
      ? (snapshot.audio as Record<string, unknown>)
      : {};
  const rawSegments = Array.isArray(snapshot.raw_asr_segments)
    ? snapshot.raw_asr_segments
    : Array.isArray(current?.raw_asr_segments)
      ? current.raw_asr_segments
      : [];
  const segments = Array.isArray(snapshot.segments)
    ? (snapshot.segments as SegmentLike[])
    : Array.isArray(current?.segments)
      ? current.segments
      : [];
  const transcript =
    sanitizeDisplayText(
      typeof snapshot.transcript === "string"
        ? snapshot.transcript
        : typeof current?.transcript === "string"
          ? current.transcript
          : "--",
      "--",
    );

  return (
    <div className="space-y-4">
      <SpotlightTile
        label="Source"
        value={String(audio.source_path || "n/a")}
      />

      <PipelineSectionBlock label="Input metadata">
        <div className="overflow-hidden rounded-[16px] border border-border/65 bg-secondary/18">
          <div className="grid grid-cols-3 border-b border-border/60">
            {["Format", "ASR mode", "Language"].map((label) => (
              <div
                key={label}
                className="px-3 py-2 text-center ui-label-xs text-muted-foreground"
              >
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3">
            {[
              String(audio.format || "n/a"),
              String(snapshot.asr_mode || currentMeta.asr_mode || "n/a"),
              String(snapshot.language || currentMeta.language || "unknown"),
            ].map((value, index) => (
              <div
                key={`${value}-${index}`}
                className="border-r border-border/60 px-3 py-2 text-center text-sm font-medium leading-5 last:border-r-0"
              >
                {value}
              </div>
            ))}
          </div>
        </div>
      </PipelineSectionBlock>

      <PipelineSectionBlock label="Transcript">
        <div className="text-sm leading-7">{transcript}</div>
      </PipelineSectionBlock>

      <div className="grid gap-3 lg:grid-cols-2">
        <PipelineSectionBlock label="Raw ASR chunks">
          <div className="space-y-3">
            {rawSegments.slice(0, 3).map((segment) => (
              <div key={String((segment as SegmentLike).segment_id)} className="console-panel-soft text-sm leading-6">
                {String((segment as SegmentLike).text || "")}
              </div>
            ))}
          </div>
        </PipelineSectionBlock>
        <PipelineSectionBlock label="Segments">
          <div className="space-y-3">
            {segments.slice(0, 3).map((segment) => (
              <div key={segment.segment_id} className="console-panel-soft">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{segment.segment_id}</span>
                  <span>
                    {formatSeconds(segment.start)} - {formatSeconds(segment.end)}
                  </span>
                </div>
                <div className="mt-2 text-sm leading-6">{String(segment.text || "")}</div>
              </div>
            ))}
          </div>
        </PipelineSectionBlock>
      </div>
    </div>
  );
}
