import { SectionEyebrow } from '@/components/shared/SectionEyebrow';
import { SurfaceSection } from '@/components/shared/SurfaceSection';
import { cn } from '@/lib/utils';

type MetaTileProps = {
  label: string;
  value: string;
  long?: boolean;
};

export function MetaTile({ label, value, long = false }: MetaTileProps) {
  return (
    <SurfaceSection
      title={
        <SectionEyebrow className='ui-label-xs text-stone-500'>
          {label}
        </SectionEyebrow>
      }
      subtle
      bodyClassName='mt-2'
      titleClassName='font-normal'
    >
      <div
        className={cn(
          long
            ? 'break-words text-sm leading-6 text-stone-900'
            : 'text-sm font-medium text-stone-900'
        )}
      >
        {value || '--'}
      </div>
    </SurfaceSection>
  );
}
