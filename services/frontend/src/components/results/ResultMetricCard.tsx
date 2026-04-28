import type { ReactNode } from 'react';

import { SectionEyebrow } from '@/components/shared/SectionEyebrow';
import { SurfaceSection } from '@/components/shared/SurfaceSection';

type ResultMetricCardProps = {
  label: string;
  value: ReactNode;
  icon: ReactNode;
};

export function ResultMetricCard({
  label,
  value,
  icon,
}: ResultMetricCardProps) {
  return (
    <SurfaceSection
      title={
        <SectionEyebrow className='flex items-center gap-2'>
          {icon}
          <span>{label}</span>
        </SectionEyebrow>
      }
      subtle
      bodyClassName='mt-2'
      titleClassName='font-normal'
    >
      <div className='font-display text-3xl text-foreground'>{value}</div>
    </SurfaceSection>
  );
}
