import { EventMetaStrip } from "@/components/pipeline/EventMetaStrip";
import { PayloadFieldList } from "@/components/pipeline/PayloadFieldList";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { PipelineInfoBlock } from "@/components/pipeline/PipelineInfoBlock";
import { PipelineSectionBlock } from "@/components/pipeline/PipelineSectionBlock";
import { asRecord, formatTime } from "@/lib/analysis-helpers";
import { useAnalysisStore } from "@/store/analysis-store";

export function EventDetailPanel() {
  const mode = useAnalysisStore((state) => state.mode);
  const events = useAnalysisStore((state) => state.events);
  const replayCursor = useAnalysisStore((state) => state.replayCursor);
  const activeNode = useAnalysisStore((state) => state.activeNode);
  const activePayload = useAnalysisStore((state) => state.activePayload);

  const activeEvent =
    mode === "replay" ? events[replayCursor] || null : events.length ? events[events.length - 1] : null;
  const payload = asRecord(activePayload) || asRecord(activeEvent?.payload) || {};
  const substep = typeof payload.substep === "string" ? payload.substep : null;
  const requestId =
    typeof payload.request_id === "string"
      ? payload.request_id
      : typeof activeEvent?.request_id === "string"
        ? activeEvent.request_id
        : "--";
  const traceId =
    typeof payload.trace_id === "string"
      ? payload.trace_id
      : typeof activeEvent?.trace_id === "string"
        ? activeEvent.trace_id
        : "--";

  return (
    <PageSectionCard eyebrow="Timeline" title="Event spotlight" contentClassName="flex flex-col gap-4">
      {!activeEvent ? (
        <EmptyState title="No event selected" />
      ) : (
        <>
          <EventMetaStrip
            eventType={activeEvent.event_type}
            status={activeEvent.status || "--"}
            node={activeEvent.node || ""}
            activeNode={activeNode}
            createdAt={activeEvent.created_at}
            formattedTime={formatTime(activeEvent.created_at)}
            substep={substep}
            progressLabel={activeEvent.progress != null ? `${Math.round(activeEvent.progress * 100)}%` : "--"}
            requestId={requestId}
            traceId={traceId}
          />

          <PipelineInfoBlock label="Message" value={activeEvent.message || "No runtime message captured."} tone="tone-accent-soft" />

          <PipelineSectionBlock label="Payload snapshot">
            <PayloadFieldList payload={payload} />
          </PipelineSectionBlock>
        </>
      )}
    </PageSectionCard>
  );
}
