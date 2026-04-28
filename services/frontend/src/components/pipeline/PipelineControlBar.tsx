import {
  type PipelineView,
  PipelineViewTabs,
} from '@/components/pipeline/PipelineViewTabs';
import { ControlStatCard } from '@/components/shared/ControlStatCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { WorkspaceControlBar } from '@/components/shared/WorkspaceControlBar';
import { prettifyNode } from '@/lib/analysis-helpers';
import { useAnalysisStore } from '@/store/analysis-store';
import { pipelineOrder } from '@/types/analysis';

type PipelineControlBarProps = {
  activeView: PipelineView;
  onChange: (view: PipelineView) => void;
};

export function PipelineControlBar({
  activeView,
  onChange,
}: PipelineControlBarProps) {
  const mode = useAnalysisStore((state) => state.mode);
  const job = useAnalysisStore((state) => state.job);
  const activeNode = useAnalysisStore((state) => state.activeNode);
  const eventsCount = useAnalysisStore((state) => state.events.length);
  const replayCursor = useAnalysisStore((state) => state.replayCursor);

  const completedSteps = job?.completed_steps || 0;
  const totalSteps = job?.total_steps || pipelineOrder.length;
  const frameLabel =
    mode === 'replay' ? `Frame ${replayCursor + 1}` : `${eventsCount} events`;

  return (
    <WorkspaceControlBar
      tabs={<PipelineViewTabs active={activeView} onChange={onChange} />}
      statsClassName='sm:grid-cols-4'
      stats={
        <>
          <ControlStatCard
            label='Active node'
            value={prettifyNode(job?.current_node || activeNode)}
          />
          <ControlStatCard
            label='Progress'
            value={`${completedSteps}/${totalSteps} stages`}
          />
          <ControlStatCard label='Stream' value={frameLabel} />
          <ControlStatCard
            label='Status'
            value={
              <div className='flex items-center gap-3'>
                <StatusBadge
                  status={mode === 'replay' ? 'completed' : job?.status}
                  label={mode === 'live' ? job?.status || 'idle' : 'replay'}
                />
              </div>
            }
          />
        </>
      }
    />
  );
}
