import { Badge } from '@/components/ui/badge';

type SeverityBadgeProps = {
  severity?: string | null;
  className?: string;
};

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const value = severity || 'unknown';
  const variant =
    value === 'high'
      ? 'destructive'
      : value === 'stable'
        ? 'accent'
        : 'outline';
  return (
    <Badge variant={variant} className={className}>
      {value}
    </Badge>
  );
}
