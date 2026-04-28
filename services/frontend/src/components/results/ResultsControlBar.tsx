import {
  type ResultsView,
  ResultsViewTabs,
} from '@/components/results/ResultsViewTabs';
import { ControlStatCard } from '@/components/shared/ControlStatCard';
import { PerformanceLevelBadge } from '@/components/shared/PerformanceLevelBadge';
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
      statsClassName='sm:grid-cols-5'
      stats={
        <>
          <ControlStatCard
            label='Overall score'
            value={
              summary.overallScore != null
                ? summary.overallScore.toFixed(2)
                : 'n/a'
            }
          />
          <ControlStatCard
            label='Risk score'
            value={
              summary.riskScore != null ? summary.riskScore.toFixed(2) : 'n/a'
            }
          />
          <ControlStatCard
            label='Level'
            value={<PerformanceLevelBadge level={summary.level} />}
          />
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
