import type { ReactNode } from 'react';

import { SectionEyebrow } from '@/components/shared/SectionEyebrow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type PageSectionCardProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
};

export function PageSectionCard({
  id,
  eyebrow,
  title,
  action,
  children,
  className,
  contentClassName,
  headerClassName,
}: PageSectionCardProps) {
  return (
    <Card id={id} className={cn('flex min-h-0 flex-col', className)}>
      <CardHeader
        className={cn(
          'shrink-0 border-b border-border/55 px-5 py-4',
          headerClassName
        )}
      >
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div className='min-w-0 space-y-1.5'>
            {eyebrow ? <SectionEyebrow>{eyebrow}</SectionEyebrow> : null}
            <CardTitle className='leading-none'>{title}</CardTitle>
          </div>
          {action ? <div className='shrink-0'>{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={cn('flex-1 px-5 py-4', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
