import { ResultSelectableCard } from '@/components/results/ResultSelectableCard';
import { SeverityBadge } from '@/components/shared/SeverityBadge';

type FeedbackDeckCardProps = {
  segmentId: string;
  severity: string | null;
  focusTags: string[];
  practice: string;
  practiceSteps: string[];
  evidenceSources: string[];
  selected: boolean;
  onSelect?: (segmentId: string) => void;
};

export function FeedbackDeckCard({
  segmentId,
  severity,
  focusTags,
  practice,
  practiceSteps,
  evidenceSources,
  selected,
  onSelect,
}: FeedbackDeckCardProps) {
  const focusPreview = focusTags[0] || 'General delivery';
  const practicePreview =
    practiceSteps[0] || practice || 'No practice action captured.';
  const evidencePreview = evidenceSources.length
    ? evidenceSources.join(' · ')
    : 'No evidence linked';
  const statBlocks = [
    ['Tags', String(focusTags.length)],
    ['Steps', String(practiceSteps.length)],
    ['Sources', String(evidenceSources.length)],
  ] as const;

  return (
    <ResultSelectableCard
      selected={selected}
      onClick={() => {
        if (segmentId && onSelect) {
          onSelect(segmentId);
        }
      }}
      className='group'
    >
      <div className='grid gap-3 xl:grid-cols-[1fr_1.1fr_0.9fr] xl:items-center'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2'>
            <div className='truncate text-sm font-semibold'>{segmentId}</div>
            <SeverityBadge severity={severity} />
          </div>
          <div className='mt-1 truncate text-xs text-muted-foreground'>
            {focusPreview}
          </div>
        </div>

        <div className='min-w-0'>
          <div className='console-index-label'>Practice cue</div>
          <div className='console-index-value truncate'>{practicePreview}</div>
        </div>

        <div className='min-w-0'>
          <div className='console-index-label'>Evidence channels</div>
          <div className='console-index-value truncate'>{evidencePreview}</div>
        </div>
      </div>

      <div className='mt-3 overflow-hidden rounded-[14px] border border-border/70 bg-secondary/20'>
        <div className='grid grid-cols-3 border-b border-border/60'>
          {statBlocks.map(([label]) => (
            <div
              key={`${segmentId}-${label}-header`}
              className='px-3 py-2 text-center console-index-label'
            >
              {label}
            </div>
          ))}
        </div>
        <div className='grid grid-cols-3'>
          {statBlocks.map(([label, value]) => (
            <div
              key={`${segmentId}-${label}-value`}
              className='border-r border-border/60 px-3 py-2 text-center last:border-r-0'
            >
              <div className='text-sm font-semibold leading-5 text-foreground'>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ResultSelectableCard>
  );
}
