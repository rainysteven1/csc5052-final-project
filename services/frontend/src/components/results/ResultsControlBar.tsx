import {
  type ResultsView,
  ResultsViewTabs,
} from '@/components/results/ResultsViewTabs';
import { ControlStatCard } from '@/components/shared/ControlStatCard';
import { WorkspaceControlBar } from '@/components/shared/WorkspaceControlBar';
import { buildResultSummary } from '@/lib/analysis-helpers';
import { useAnalysisStore } from '@/store/analysis-store';

type ResultsControlBarProps = {
  activeView: ResultsView;
  onChange: (view: ResultsView) => void;
};

export function ResultsControlBar({
  activeView,
  onChange,
}: ResultsControlBarProps) {
  const finalState = useAnalysisStore((state) => state.finalState);
  const job = useAnalysisStore((state) => state.job);
  const summary = buildResultSummary(finalState, job);

  return (
    <WorkspaceControlBar
      tabs={<ResultsViewTabs active={activeView} onChange={onChange} />}
      statsClassName='sm:grid-cols-4'
      stats={
        <>
          <ControlStatCard
            label='Score'
            value={
              summary.overallScore != null
                ? summary.overallScore.toFixed(2)
                : 'n/a'
            }
          />
          <ControlStatCard label='Level' value={summary.level || 'n/a'} />
          <ControlStatCard
            label='Feedback rows'
            value={String(summary.feedbackRows.length)}
          />
          <ControlStatCard
            label='Segments'
            value={String(summary.segmentResults.length)}
          />
        </>
      }
    />
  );
}
