import type { ResultsView } from '@/components/results/ResultsViewTabs';
import { PageSectionCard } from '@/components/shared/PageSectionCard';
import {
  StatCardGrid,
  type StatCardItem,
} from '@/components/shared/StatCardGrid';
import {
  asStringArray,
  buildResultSummary,
  formatPerformanceLevel,
} from '@/lib/analysis-helpers';
import { useAnalysisStore } from '@/store/analysis-store';

type ResultsLensPanelProps = {
  view: ResultsView;
  activeFeedbackId: string | null;
  activeSegmentId: string | null;
};

const lensConfig: Record<ResultsView, { eyebrow: string; title: string }> = {
  summary: { eyebrow: 'Digest', title: 'Summary lens' },
  feedback: { eyebrow: 'Coaching', title: 'Feedback lens' },
  segments: { eyebrow: 'Diagnostics', title: 'Segment lens' },
};

export function ResultsLensPanel({
  view,
  activeFeedbackId,
  activeSegmentId,
}: ResultsLensPanelProps) {
  const finalState = useAnalysisStore((state) => state.finalState);
  const job = useAnalysisStore((state) => state.job);
  const summary = buildResultSummary(finalState, job);

  const activeFeedback =
    summary.feedbackRows.find(
      (row) => String(row.segment_id || '') === activeFeedbackId
    ) ||
    summary.feedbackRows[0] ||
    null;
  const activeSegment =
    summary.segmentResults.find(
      (segment) => segment.segment_id === activeSegmentId
    ) ||
    summary.segmentResults[0] ||
    null;
  const config = lensConfig[view];
  const cardsByView = buildCardsByView(
    summary,
    activeFeedback,
    activeSegment,
    activeFeedbackId,
    activeSegmentId
  );

  return (
    <PageSectionCard eyebrow={config.eyebrow} title={config.title}>
      <StatCardGrid items={cardsByView[view]} />
    </PageSectionCard>
  );
}

function buildCardsByView(
  summary: ReturnType<typeof buildResultSummary>,
  activeFeedback: Record<string, unknown> | null,
  activeSegment: (typeof summary.segmentResults)[number] | null,
  activeFeedbackId: string | null,
  activeSegmentId: string | null
): Record<ResultsView, StatCardItem[]> {
  return {
    summary: [
      {
        label: 'Overall score',
        value:
          summary.overallScore != null
            ? summary.overallScore.toFixed(2)
            : 'n/a',
        meta: formatPerformanceLevel(summary.level),
      },
      {
        label: 'Risk score',
        value: summary.riskScore != null ? summary.riskScore.toFixed(2) : 'n/a',
        meta: summary.level
          ? `${formatPerformanceLevel(summary.level)} band`
          : 'level pending',
      },
      {
        label: 'Dominant causes',
        value: String(summary.dominantCauses.length),
        meta: summary.dominantCauses[0] || 'no cause tags',
      },
      {
        label: 'Coaching focus',
        value: String(summary.coachingFocus.length),
        meta: summary.coachingFocus[0] || 'no focus items',
      },
    ],
    feedback: [
      {
        label: 'Selected card',
        value: activeFeedback
          ? String(activeFeedback.segment_id || 'segment')
          : 'none',
        meta: activeFeedback
          ? String(activeFeedback.severity || 'unknown')
          : 'no active card',
      },
      {
        label: 'Focus tags',
        value: activeFeedback
          ? String(asStringArray(activeFeedback.focus_tags).length)
          : '0',
        meta: activeFeedback
          ? asStringArray(activeFeedback.focus_tags)[0] || 'no tags'
          : 'no tags',
      },
      {
        label: 'Practice steps',
        value: activeFeedback
          ? String(asStringArray(activeFeedback.practice_steps).length)
          : '0',
        meta: activeFeedback
          ? String(activeFeedback.practice || 'no practice note')
          : 'no practice note',
      },
    ],
    segments: [
      {
        label: 'Selected segment',
        value: activeSegment?.segment_id || 'none',
        meta: activeSegment
          ? `${activeSegment.token_count || 0} tokens`
          : 'no active segment',
      },
      {
        label: 'Combined risk',
        value:
          typeof activeSegment?.scores?.final === 'number'
            ? activeSegment.scores.final.toFixed(3)
            : 'n/a',
        meta: activeSegment?.text
          ? activeSegment.text.slice(0, 48)
          : 'no segment text',
      },
      {
        label: 'Linked coaching',
        value: activeFeedbackId || activeSegmentId || 'none',
        meta: activeFeedback
          ? String(
              activeFeedback.problem ||
                activeFeedback.reason ||
                'no linked coaching note'
            )
          : 'no linked coaching note',
      },
    ],
  };
}
