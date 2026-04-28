import { scoreToPercent } from '@/lib/analysis-helpers';
import { cn } from '@/lib/utils';

type MetricBarProps = {
  label: string;
  value: unknown;
  tone?: string;
};

export function MetricBar({
  label,
  value,
  tone = 'from-primary to-accent',
}: MetricBarProps) {
  const percent = scoreToPercent(value);

  return (
    <div className='space-y-2'>
      <div className='flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground'>
        <span className='ui-label-xs min-w-0 break-words'>{label}</span>
        <span className='shrink-0'>
          {typeof value === 'number' ? value.toFixed(2) : String(value ?? '--')}
        </span>
      </div>
      <div className='h-2 rounded-full bg-secondary'>
        <div
          className={cn('h-2 rounded-full bg-gradient-to-r', tone)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
