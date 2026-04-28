import { ResultsControlBar, ResultsWorkspace } from '@/components/results';
import { useResultsPageState } from '@/hooks/useResultsPageState';

export function ResultsPage() {
  const {
    activeFeedbackId,
    activeSegmentId,
    activeView,
    handleFeedbackSelect,
    handleSegmentSelect,
    handleViewChange,
  } = useResultsPageState();

  return (
    <div className='flex flex-col gap-5 pb-6'>
      <ResultsControlBar activeView={activeView} onChange={handleViewChange} />
      <div>
        <ResultsWorkspace
          view={activeView}
          activeFeedbackId={activeFeedbackId}
          activeSegmentId={activeSegmentId}
          onFeedbackSelect={handleFeedbackSelect}
          onSegmentSelect={handleSegmentSelect}
        />
      </div>
    </div>
  );
}
