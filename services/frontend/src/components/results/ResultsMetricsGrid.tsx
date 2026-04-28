import { AlertTriangle, Gauge, Layers3 } from 'lucide-react';

import { ResultMetricCard } from '@/components/results/ResultMetricCard';
import { PerformanceLevelBadge } from '@/components/shared/PerformanceLevelBadge';
import type { ResultSummary } from '@/types/analysis';

type ResultsMetricsGridProps = {
  summary: ResultSummary;
};

export function ResultsMetricsGrid({ summary }: ResultsMetricsGridProps) {
  return (
    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
      <ResultMetricCard
        label='Overall score'
        value={
          summary.overallScore != null ? summary.overallScore.toFixed(3) : '--'
        }
        icon={<Gauge className='h-4 w-4' />}
      />
      <ResultMetricCard
        label='Level'
        value={<PerformanceLevelBadge level={summary.level} />}
        icon={<Layers3 className='h-4 w-4' />}
      />
      <ResultMetricCard
        label='Warnings'
        value={String(summary.warnings.length)}
        icon={<AlertTriangle className='h-4 w-4' />}
      />
    </div>
  );
}
