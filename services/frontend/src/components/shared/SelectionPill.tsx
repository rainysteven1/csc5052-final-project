import { cn } from '@/lib/utils';

type SelectionPillProps = {
  label: string;
  active?: boolean;
  className?: string;
};

export function SelectionPill({
  label,
  active = false,
  className,
}: SelectionPillProps) {
  return (
    <span
      className={cn(
        'ui-label-xs rounded-full border px-3 py-1',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'console-pill-muted text-muted-foreground',
        className
      )}
    >
      {label}
    </span>
  );
}
