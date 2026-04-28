import { CoachingDrilldownPanel } from '@/components/results/CoachingDrilldownPanel';
import { FeedbackDeck } from '@/components/results/FeedbackDeck';
import { FeedbackSpotlightPanel } from '@/components/results/FeedbackSpotlightPanel';
import { ResultsHero } from '@/components/results/ResultsHero';
import type { ResultsView } from '@/components/results/ResultsViewTabs';
import { SegmentResultsPanel } from '@/components/results/SegmentResultsPanel';
import { SegmentSpotlightPanel } from '@/components/results/SegmentSpotlightPanel';

const stackedColumnClass = 'grid gap-5';

type ResultsWorkspaceColumnsProps = {
  view: ResultsView;
  activeFeedbackId: string | null;
  activeSegmentId: string | null;
  onFeedbackSelect: (segmentId: string) => void;
  onSegmentSelect: (segmentId: string) => void;
};

export function getResultsWorkspaceColumns({
  view,
  activeFeedbackId,
  activeSegmentId,
  onFeedbackSelect,
  onSegmentSelect,
}: ResultsWorkspaceColumnsProps) {
  return {
    left: buildResultsLeftColumn(view, activeFeedbackId, activeSegmentId),
    right: buildResultsRightColumn(
      view,
      activeFeedbackId,
      activeSegmentId,
      onFeedbackSelect,
      onSegmentSelect
    ),
  };
}

function buildResultsLeftColumn(
  view: ResultsView,
  activeFeedbackId: string | null,
  activeSegmentId: string | null
) {
  const columns: Record<ResultsView, JSX.Element> = {
    summary: <ResultsHero />,
    feedback: <FeedbackSpotlightPanel selectedId={activeFeedbackId} />,
    segments: <SegmentSpotlightPanel selectedId={activeSegmentId} />,
  };

  return columns[view];
}

function buildResultsRightColumn(
  view: ResultsView,
  activeFeedbackId: string | null,
  activeSegmentId: string | null,
  onFeedbackSelect: (segmentId: string) => void,
  onSegmentSelect: (segmentId: string) => void
) {
  const columns: Record<ResultsView, JSX.Element> = {
    summary: (
      <div className={stackedColumnClass}>
        <div className='min-h-0'>
          <CoachingDrilldownPanel />
        </div>
        <div className='min-h-0'>
          <SegmentSpotlightPanel selectedId={activeSegmentId} />
        </div>
      </div>
    ),
    feedback: (
      <div className={stackedColumnClass}>
        <div className='min-h-0'>
          <FeedbackDeck
            selectedId={activeFeedbackId}
            onSelect={onFeedbackSelect}
          />
        </div>
      </div>
    ),
    segments: (
      <div className={stackedColumnClass}>
        <div className='min-h-0'>
          <SegmentResultsPanel
            selectedId={activeSegmentId}
            onSelect={onSegmentSelect}
          />
        </div>
      </div>
    ),
  };

  return columns[view];
}
