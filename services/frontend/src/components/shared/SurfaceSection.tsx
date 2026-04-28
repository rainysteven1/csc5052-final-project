import type { ReactNode } from 'react';

import { SectionEyebrow } from '@/components/shared/SectionEyebrow';
import { cn } from '@/lib/utils';

type SurfaceSectionProps = {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  titleClassName?: string;
  subtle?: boolean;
  paddingClassName?: string;
};

export function SurfaceSection({
  title,
  action,
  children,
  className,
  headerClassName,
  bodyClassName,
  titleClassName,
  subtle = false,
  paddingClassName = 'p-4',
}: SurfaceSectionProps) {
  return (
    <div
      className={cn(
        subtle ? 'console-surface-subtle' : 'console-surface',
        paddingClassName,
        className
      )}
    >
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3',
          headerClassName
        )}
      >
        <div className={cn('font-medium', titleClassName)}>{title}</div>
        {action}
      </div>
      <div className={cn('mt-4', bodyClassName)}>{children}</div>
    </div>
  );
}

type SurfaceLabelSectionProps = {
  label: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  subtle?: boolean;
  paddingClassName?: string;
};

export function SurfaceLabelSection({
  label,
  action,
  children,
  className,
  headerClassName,
  bodyClassName,
  subtle = false,
  paddingClassName = 'p-4',
}: SurfaceLabelSectionProps) {
  return (
    <SurfaceSection
      title={<SectionEyebrow>{label}</SectionEyebrow>}
      action={action}
      className={className}
      headerClassName={headerClassName}
      bodyClassName={bodyClassName}
      titleClassName='font-normal'
      subtle={subtle}
      paddingClassName={paddingClassName}
    >
      {children}
    </SurfaceSection>
  );
}
