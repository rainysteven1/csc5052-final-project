import { PipelineInfoBlock } from "@/components/pipeline/PipelineInfoBlock";
import { prettifyNode } from "@/lib/analysis-helpers";

type EventMetaStripProps = {
  eventType: string;
  status: string;
  node: string;
  activeNode: string;
  createdAt: string;
  formattedTime: string;
  substep: string | null;
  progressLabel: string;
  requestId: string;
  traceId: string;
};

export function EventMetaStrip({
  eventType,
  status,
  node,
  activeNode,
  createdAt,
  formattedTime,
  substep,
  progressLabel,
  requestId,
  traceId,
}: EventMetaStripProps) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PipelineInfoBlock label="Event" value={eventType} valueClassName="font-medium" />
        <PipelineInfoBlock label="Status" value={status || "--"} valueClassName="font-medium" />
        <PipelineInfoBlock label="Node" value={prettifyNode(node || activeNode)} valueClassName="font-medium" />
        <PipelineInfoBlock label="Time" value={formattedTime} valueClassName="font-medium" detail={createdAt} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <PipelineInfoBlock label="Substep" value={substep ? prettifyNode(substep) : "--"} valueClassName="font-medium" />
        <PipelineInfoBlock label="Progress" value={progressLabel} valueClassName="font-medium" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <PipelineInfoBlock label="Request ID" value={requestId} />
        <PipelineInfoBlock label="Trace ID" value={traceId} />
      </div>
    </div>
  );
}
