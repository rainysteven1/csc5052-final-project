import { AlertTriangle, Gauge, Layers3, ShieldAlert } from 'lucide-react';

import { ResultMetricCard } from '@/components/results/ResultMetricCard';
import type { ResultSummary } from '@/types/analysis';

type ResultsMetricsGridProps = {
  summary: ResultSummary;
};

export function ResultsMetricsGrid({ summary }: ResultsMetricsGridProps) {
  return (
    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
      <ResultMetricCard
        label='Score'
        value={
          summary.overallScore != null ? summary.overallScore.toFixed(3) : '--'
        }
        icon={<Gauge className='h-4 w-4' />}
      />
      <ResultMetricCard
        label='Level'
        value={summary.level || '--'}
        icon={<Layers3 className='h-4 w-4' />}
      />
      <ResultMetricCard
        label='Warnings'
        value={String(summary.warnings.length)}
        icon={<AlertTriangle className='h-4 w-4' />}
      />
      <ResultMetricCard
        label='Errors'
        value={String(summary.errors.length)}
        icon={<ShieldAlert className='h-4 w-4' />}
      />
    </div>
  );
}
