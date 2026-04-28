import { ResultSelectableCard } from '@/components/results/ResultSelectableCard';
import { SectionEyebrow } from '@/components/shared/SectionEyebrow';
import { formatSeconds } from '@/lib/analysis-helpers';
import type { SegmentLike } from '@/types/analysis';

type SegmentResultCardProps = {
  segment: SegmentLike;
  drillRows: Array<[string, string]>;
  selected: boolean;
  onSelect?: (segmentId: string) => void;
};

export function SegmentResultCard({
  segment,
  drillRows,
  selected,
  onSelect,
}: SegmentResultCardProps) {
  const scoreRows = [
    ['Lexical', segment.scores?.lexical],
    ['Prosody', segment.scores?.prosody],
    ['Disfluency', segment.scores?.disfluency],
    ['Final', segment.scores?.final],
  ] as const;
  const weakestScore = scoreRows.reduce<(typeof scoreRows)[number] | null>(
    (lowest, current) => {
      if (typeof current[1] !== 'number') {
        return lowest;
      }
      if (!lowest || typeof lowest[1] !== 'number' || current[1] < lowest[1]) {
        return current;
      }
      return lowest;
    },
    null
  );

  return (
    <ResultSelectableCard
      selected={selected}
      onClick={() => onSelect?.(segment.segment_id)}
      className='group'
    >
      <div className='grid gap-3 xl:grid-cols-[1fr_0.95fr] xl:items-center'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2'>
            <div className='truncate text-sm font-semibold'>
              {segment.segment_id}
            </div>
            <SectionEyebrow>
              final {segment.scores?.final?.toFixed(3) || '--'}
            </SectionEyebrow>
          </div>
          <div className='mt-1 text-xs text-muted-foreground'>
            {formatSeconds(segment.start)} - {formatSeconds(segment.end)} ·{' '}
            {segment.token_count || 0} tokens
          </div>
        </div>

        <div className='grid gap-2 sm:grid-cols-2'>
          <div className='console-index-stat'>
            <div className='console-index-label'>Weakest</div>
            <div className='console-index-value truncate'>
              {weakestScore
                ? `${weakestScore[0]} ${typeof weakestScore[1] === 'number' ? weakestScore[1].toFixed(3) : '--'}`
                : '--'}
            </div>
          </div>
          <div className='console-index-stat'>
            <div className='console-index-label'>Evidence</div>
            <div className='console-index-value'>{drillRows.length}</div>
          </div>
        </div>
      </div>

      <div className='mt-3 overflow-hidden rounded-[14px] border border-border/70 bg-secondary/20'>
        <div className='grid grid-cols-4 border-b border-border/60'>
          {scoreRows.map(([label]) => (
            <div
              key={`${segment.segment_id}-${label}-header`}
              className='px-3 py-2 text-center console-index-label'
            >
              {label}
            </div>
          ))}
        </div>
        <div className='grid grid-cols-4'>
          {scoreRows.map(([label, value]) => (
            <div
              key={`${segment.segment_id}-${label}-value`}
              className='border-r border-border/60 px-3 py-2 text-center last:border-r-0'
            >
              <div className='text-sm font-semibold leading-5 text-foreground'>
                {typeof value === 'number' ? value.toFixed(3) : '--'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ResultSelectableCard>
  );
}
