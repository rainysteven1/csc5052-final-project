import { Badge } from '@/components/ui/badge';
import { formatPerformanceLevel } from '@/lib/analysis-core';

type PerformanceLevelBadgeProps = {
  level?: string | null;
  className?: string;
};

export function PerformanceLevelBadge({
  level,
  className,
}: PerformanceLevelBadgeProps) {
  const normalized =
    typeof level === 'string' ? level.trim().toLowerCase() : '';
  const variant =
    normalized === 'excellent'
      ? 'accent'
      : normalized === 'good'
        ? 'default'
        : normalized === 'needs_work'
          ? 'destructive'
          : 'outline';

  return (
    <Badge
      variant={variant}
      className={`normal-case tracking-[0.04em] ${className || ''}`.trim()}
    >
      {formatPerformanceLevel(level)}
    </Badge>
  );
}
