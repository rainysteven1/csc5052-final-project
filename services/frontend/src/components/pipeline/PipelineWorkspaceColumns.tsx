import { EventDetailPanel } from '@/components/pipeline/EventDetailPanel';
import { EvidenceDrilldownPanel } from '@/components/pipeline/EvidenceDrilldownPanel';
import { NodeDetailPanel } from '@/components/pipeline/NodeDetailPanel';
import { NodeGrid } from '@/components/pipeline/NodeGrid';
import type { PipelineView } from '@/components/pipeline/PipelineViewTabs';
import { TimelinePanel } from '@/components/pipeline/TimelinePanel';

const stackedColumnClass = 'grid gap-5';

type PipelineWorkspaceColumnsProps = {
  view: PipelineView;
};

export function getPipelineWorkspaceColumns({
  view,
}: PipelineWorkspaceColumnsProps) {
  const right = buildPipelineRightColumn(view);

  return {
    left: buildPipelineLeftColumn(view),
    right,
    hasRightColumn: Boolean(right),
  };
}

function buildPipelineLeftColumn(view: PipelineView) {
  const columns: Record<PipelineView, JSX.Element> = {
    overview: <NodeGrid />,
    evidence: <EvidenceDrilldownPanel />,
    timeline: <TimelinePanel />,
  };

  return columns[view];
}

function buildPipelineRightColumn(view: PipelineView) {
  const columns: Record<PipelineView, JSX.Element | null> = {
    overview: (
      <div className='min-h-0'>
        <NodeDetailPanel />
      </div>
    ),
    evidence: null,
    timeline: (
      <div className={stackedColumnClass}>
        <div className='min-h-0'>
          <EventDetailPanel />
        </div>
      </div>
    ),
  };

  return columns[view];
}
