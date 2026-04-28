import { TraceBadge } from '@/components/debug/TraceBadge';
import { asRecord } from '@/lib/analysis-helpers';
import { cn } from '@/lib/utils';
import { useAnalysisStore } from '@/store/analysis-store';

type TraceBadgeRowProps = {
  compact?: boolean;
  className?: string;
};

export function TraceBadgeRow({
  compact = false,
  className,
}: TraceBadgeRowProps) {
  const finalState = useAnalysisStore((state) => state.finalState);
  const job = useAnalysisStore((state) => state.job);
  const activePayload = useAnalysisStore((state) => state.activePayload);

  const payload = asRecord(activePayload) || {};
  const requestId =
    finalState?.request_id ||
    (typeof payload.request_id === 'string' ? payload.request_id : null) ||
    job?.request_id ||
    job?.analysis_id ||
    null;
  const traceId =
    (typeof payload.trace_id === 'string' ? payload.trace_id : null) ||
    job?.trace_id ||
    null;
  const items = [
    { label: 'Request ID', value: requestId },
    { label: 'Trace ID', value: traceId },
  ];

  return (
    <div
      className={cn(
        compact
          ? 'flex flex-wrap justify-end gap-2'
          : 'grid gap-2 md:grid-cols-2',
        className
      )}
    >
      {items.map((item) => (
        <TraceBadge
          key={item.label}
          label={item.label}
          value={item.value}
          compact={compact}
        />
      ))}
    </div>
  );
}
