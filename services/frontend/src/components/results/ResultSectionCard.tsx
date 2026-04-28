import type { ReactNode } from 'react';

import { SurfaceSection } from '@/components/shared/SurfaceSection';

type ResultSectionCardProps = {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
};

export function ResultSectionCard({
  title,
  action,
  children,
  className,
  headerClassName,
  bodyClassName,
}: ResultSectionCardProps) {
  return (
    <SurfaceSection
      title={title}
      action={action}
      className={className}
      headerClassName={headerClassName}
      bodyClassName={bodyClassName}
    >
      {children}
    </SurfaceSection>
  );
}
