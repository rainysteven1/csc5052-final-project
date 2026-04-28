import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { type ResultsView } from '@/components/results';
import { buildResultSummary } from '@/lib/analysis-helpers';
import { useAnalysisStore } from '@/store/analysis-store';

const resultViews: ResultsView[] = ['summary', 'feedback', 'segments'];

export function useResultsPageState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const finalState = useAnalysisStore((state) => state.finalState);
  const job = useAnalysisStore((state) => state.job);
  const summary = buildResultSummary(finalState, job);

  const feedbackIds = summary.feedbackRows
    .map((row) => String(row.segment_id || ''))
    .filter(Boolean);
  const segmentIds = summary.segmentResults.map(
    (segment) => segment.segment_id
  );
  const feedbackParam = searchParams.get('feedback');
  const segmentParam = searchParams.get('segment');
  const viewParam = searchParams.get('view');
  const activeView = resultViews.includes(viewParam as ResultsView)
    ? (viewParam as ResultsView)
    : 'summary';
  const activeFeedbackId =
    feedbackParam && feedbackIds.includes(feedbackParam)
      ? feedbackParam
      : feedbackIds[0] || null;
  const activeSegmentId =
    segmentParam && segmentIds.includes(segmentParam)
      ? segmentParam
      : activeFeedbackId && segmentIds.includes(activeFeedbackId)
        ? activeFeedbackId
        : segmentIds[0] || null;

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    let changed = false;

    if (activeFeedbackId) {
      if (nextParams.get('feedback') !== activeFeedbackId) {
        nextParams.set('feedback', activeFeedbackId);
        changed = true;
      }
    } else if (nextParams.has('feedback')) {
      nextParams.delete('feedback');
      changed = true;
    }

    if (activeSegmentId) {
      if (nextParams.get('segment') !== activeSegmentId) {
        nextParams.set('segment', activeSegmentId);
        changed = true;
      }
    } else if (nextParams.has('segment')) {
      nextParams.delete('segment');
      changed = true;
    }

    if (nextParams.get('view') !== activeView) {
      nextParams.set('view', activeView);
      changed = true;
    }

    if (changed) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    activeFeedbackId,
    activeSegmentId,
    activeView,
    searchParams,
    setSearchParams,
  ]);

  const handleFeedbackSelect = (segmentId: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('feedback', segmentId);
    if (segmentIds.includes(segmentId)) {
      nextParams.set('segment', segmentId);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleSegmentSelect = (segmentId: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('segment', segmentId);
    if (feedbackIds.includes(segmentId)) {
      nextParams.set('feedback', segmentId);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleViewChange = (view: ResultsView) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('view', view);
    setSearchParams(nextParams, { replace: true });
  };

  return {
    activeFeedbackId,
    activeSegmentId,
    activeView,
    handleFeedbackSelect,
    handleSegmentSelect,
    handleViewChange,
  };
}
