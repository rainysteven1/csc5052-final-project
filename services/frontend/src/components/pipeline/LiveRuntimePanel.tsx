import { PipelineInfoBlock } from '@/components/pipeline/PipelineInfoBlock';
import { PipelineSectionBlock } from '@/components/pipeline/PipelineSectionBlock';
import { formatTime } from '@/lib/analysis-helpers';

type LiveRuntimePanelProps = {
  latestMessage: string | null;
  latestTime: string | null;
};

export function LiveRuntimePanel({
  latestMessage,
  latestTime,
}: LiveRuntimePanelProps) {
  return (
    <PipelineSectionBlock
      label='Live stream watch'
      className='h-full'
      bodyClassName='space-y-3'
    >
      <PipelineInfoBlock
        label='Latest packet'
        value={
          latestMessage ||
          'Waiting for the backend to emit the first SSE event.'
        }
        tone='console-surface-dashed'
      />
      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2'>
        <PipelineInfoBlock
          label='Seen at'
          value={latestTime ? formatTime(latestTime) : 'Awaiting packet'}
          tone='glass-panel-soft'
          valueClassName='font-medium'
        />
        <PipelineInfoBlock
          label='Transport'
          value='Server-Sent Events'
          tone='glass-panel-soft'
          valueClassName='font-medium'
        />
        <PipelineInfoBlock
          label='Feed'
          value='Live backend stream'
          tone='glass-panel-soft'
          valueClassName='font-medium'
          className='md:col-span-2 xl:col-span-1 2xl:col-span-2'
        />
      </div>
    </PipelineSectionBlock>
  );
}
