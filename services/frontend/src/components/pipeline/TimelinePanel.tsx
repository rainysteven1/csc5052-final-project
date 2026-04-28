import { EmptyState } from "@/components/shared/EmptyState";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { PipelineSelectableCard } from "@/components/pipeline/PipelineSelectableCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { asRecord, formatTime, prettifyNode } from "@/lib/analysis-helpers";
import { useAnalysisStore } from "@/store/analysis-store";

export function TimelinePanel() {
  const mode = useAnalysisStore((state) => state.mode);
  const events = useAnalysisStore((state) => state.events);
  const replayCursor = useAnalysisStore((state) => state.replayCursor);
  const activePayload = useAnalysisStore((state) => state.activePayload);
  const selectTimelineEvent = useAnalysisStore((state) => state.selectTimelineEvent);

  const timeline = [...events].reverse();
  const replayCurrentEvent = mode === "replay" ? events[replayCursor] : null;

  return (
    <PageSectionCard eyebrow="Timeline" title={mode === "live" ? "Event stream" : "Replay timeline"}>
      <div className="space-y-3">
        {timeline.length === 0 ? (
          <EmptyState title={mode === "live" ? "No timeline events" : "No replay events"} />
        ) : (
          timeline.map((event) => {
            const payload = asRecord(event.payload) || {};
            const substep = typeof payload.substep === "string" ? payload.substep : null;
            const isSelected =
              mode === "replay"
                ? replayCurrentEvent?.created_at === event.created_at &&
                  replayCurrentEvent?.event_type === event.event_type &&
                  replayCurrentEvent?.node === event.node
                : activePayload === event.payload;

            return (
              <PipelineSelectableCard
                key={`${event.created_at}-${event.event_type}-${event.node}`}
                onClick={() => selectTimelineEvent(event)}
                selected={isSelected}
                className="p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{event.message || event.event_type}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatTime(event.created_at)} · {prettifyNode(event.node)}{substep ? ` / ${prettifyNode(substep)}` : ""} · {Math.round((event.progress || 0) * 100)}%
                    </div>
                  </div>
                  <StatusBadge status={event.status} label={event.event_type} />
                </div>
              </PipelineSelectableCard>
            );
          })
        )}
      </div>
    </PageSectionCard>
  );
}
