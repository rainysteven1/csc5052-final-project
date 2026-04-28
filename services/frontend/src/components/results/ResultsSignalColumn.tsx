import { Sparkles, Trophy } from 'lucide-react';

import { ResultInfoBlock } from '@/components/results/ResultInfoBlock';
import { ResultSignalPanel } from '@/components/results/ResultSignalPanel';
import type { ResultSummary } from '@/types/analysis';

type ResultsSignalColumnProps = {
  summary: ResultSummary;
};

export function ResultsSignalColumn({ summary }: ResultsSignalColumnProps) {
  return (
    <div className='grid gap-4'>
      <ResultInfoBlock
        label='Dominant causes'
        value={
          summary.dominantCauses.length
            ? summary.dominantCauses.join(' · ')
            : 'No dominant causes captured.'
        }
        tone='console-surface'
      />
      <ResultSignalPanel
        title='Coaching focus'
        icon={<Sparkles className='h-4 w-4' />}
        items={summary.coachingFocus}
        emptyLabel='No explicit focus'
      />
      <ResultSignalPanel
        title='Strengths'
        icon={<Trophy className='h-4 w-4' />}
        items={summary.strengths}
        emptyLabel='No strengths captured'
      />
    </div>
  );
}
