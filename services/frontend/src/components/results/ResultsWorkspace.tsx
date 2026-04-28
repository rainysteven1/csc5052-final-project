import { ResultsLensPanel } from '@/components/results/ResultsLensPanel';
import type { ResultsView } from '@/components/results/ResultsViewTabs';
import { getResultsWorkspaceColumns } from '@/components/results/ResultsWorkspaceColumns';
import { WorkspaceColumns } from '@/components/shared/WorkspaceColumns';

type ResultsWorkspaceProps = {
  view: ResultsView;
  activeFeedbackId: string | null;
  activeSegmentId: string | null;
  onFeedbackSelect: (segmentId: string) => void;
  onSegmentSelect: (segmentId: string) => void;
};

export function ResultsWorkspace({
  view,
  activeFeedbackId,
  activeSegmentId,
  onFeedbackSelect,
  onSegmentSelect,
}: ResultsWorkspaceProps) {
  const columns = getResultsWorkspaceColumns({
    view,
    activeFeedbackId,
    activeSegmentId,
    onFeedbackSelect,
    onSegmentSelect,
  });

  return (
    <div className='grid gap-5'>
      <ResultsLensPanel
        view={view}
        activeFeedbackId={activeFeedbackId}
        activeSegmentId={activeSegmentId}
      />
      <WorkspaceColumns
        left={columns.left}
        right={columns.right}
        columnsClassName='xl:grid-cols-[1.04fr_0.96fr]'
      />
    </div>
  );
}
