import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type SurfaceInfoBlockProps = {
  label: string;
  value: ReactNode;
  tone?: string;
  className?: string;
  valueClassName?: string;
  detail?: ReactNode;
  detailClassName?: string;
};

export function SurfaceInfoBlock({
  label,
  value,
  tone = 'console-surface',
  className,
  valueClassName,
  detail,
  detailClassName,
}: SurfaceInfoBlockProps) {
  return (
    <div className={cn('rounded-[22px] p-4', tone, className)}>
      <div className='ui-label-sm text-muted-foreground'>{label}</div>
      <div
        className={cn(
          'mt-2 break-words text-sm leading-6 text-foreground',
          valueClassName
        )}
      >
        {value}
      </div>
      {detail ? (
        <div
          className={cn(
            'mt-2 break-words text-sm leading-6 text-muted-foreground',
            detailClassName
          )}
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
}
