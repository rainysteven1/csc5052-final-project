import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { formatTime, prettifyNode, statusTone } from "@/lib/analysis-helpers";
import { cn } from "@/lib/utils";
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
    <PageSectionCard
      eyebrow="Timeline"
      title={mode === "live" ? "Event stream" : "Replay timeline"}
      description={
        mode === "live"
          ? "Every SSE event lands here with timestamped node progress."
          : "Synthetic timeline generated from the saved JSON so you can inspect it node by node."
      }
      className="h-full"
      contentClassName="min-h-0 flex-1"
    >
      <ScrollArea className="h-full pr-4">
        <div className="space-y-3">
          {timeline.length === 0 ? (
            <EmptyState title={mode === "live" ? "No timeline events" : "No replay events"} />
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
                  onClick={() => selectTimelineEvent(event)}
                  className={cn(
                    "w-full rounded-[24px] border bg-background/70 p-4 text-left transition-colors hover:bg-background",
                    isSelected && "border-primary ring-2 ring-primary/20",
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
    </PageSectionCard>
  );
}
