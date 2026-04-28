import { SurfaceInfoBlock } from '@/components/shared/SurfaceInfoBlock';

type ResultInfoBlockProps = {
  label: string;
  value: string;
  tone?: string;
  className?: string;
};

export function ResultInfoBlock({
  label,
  value,
  tone = 'tone-secondary-soft',
  className,
}: ResultInfoBlockProps) {
  return (
    <SurfaceInfoBlock
      label={label}
      value={value}
      tone={tone}
      className={className}
    />
  );
}
