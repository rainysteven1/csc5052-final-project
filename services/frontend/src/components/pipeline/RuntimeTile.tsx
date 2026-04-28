import { PipelineInfoBlock } from '@/components/pipeline/PipelineInfoBlock';

type RuntimeTileProps = {
  label: string;
  value: string;
  detail: string;
};

export function RuntimeTile({ label, value, detail }: RuntimeTileProps) {
  return (
    <PipelineInfoBlock
      label={label}
      value={value}
      detail={detail}
      valueClassName='text-sm font-medium'
      className='h-full'
      tone='console-surface'
    />
  );
}
