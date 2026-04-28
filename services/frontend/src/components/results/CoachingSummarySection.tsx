import { ResultInfoBlock } from '@/components/results/ResultInfoBlock';
import { ResultSectionCard } from '@/components/results/ResultSectionCard';
import { Badge } from '@/components/ui/badge';
import type { ResultSummary } from '@/types/analysis';

type CoachingSummarySectionProps = {
  summary: ResultSummary;
};

export function CoachingSummarySection({
  summary,
}: CoachingSummarySectionProps) {
  return (
    <ResultSectionCard
      title='Overall coaching synthesis'
      action={
        <div className='flex flex-wrap gap-2'>
          <Badge variant='outline'>
            {summary.coachingProvider || 'deterministic fallback'}
          </Badge>
          <Badge variant='outline'>{summary.coachingModel || 'n/a'}</Badge>
        </div>
      }
    >
      <div className='grid gap-3 lg:grid-cols-2'>
        <ResultInfoBlock
          label='Why the pipeline landed here'
          value={summary.summary}
        />
        <ResultInfoBlock
          label='Practice direction'
          value={
            summary.coachingFocus[0] ||
            summary.dominantCauses[0] ||
            'No explicit follow-up direction captured.'
          }
          tone='tone-accent-soft'
        />
      </div>

      <div className='mt-3 grid gap-3 lg:grid-cols-2'>
        <ResultInfoBlock
          label='Dominant causes'
          value={
            summary.dominantCauses.length
              ? summary.dominantCauses.join(' · ')
              : 'No dominant causes captured.'
          }
          tone='tone-secondary-muted'
        />
        <ResultInfoBlock
          label='Runtime health'
          value={`Warnings: ${summary.warnings.length} · Errors: ${summary.errors.length}`}
          tone='tone-secondary-muted'
        />
      </div>
    </ResultSectionCard>
  );
}
