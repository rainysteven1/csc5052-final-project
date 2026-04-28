import { MetricBar } from '@/components/pipeline/MetricBar';
import { PipelineSectionBlock } from '@/components/pipeline/PipelineSectionBlock';
import { formatSeconds } from '@/lib/analysis-helpers';
import type { SegmentLike } from '@/types/analysis';

type EvidenceSegmentListProps = {
  segments: SegmentLike[];
};

export function EvidenceSegmentList({ segments }: EvidenceSegmentListProps) {
  return (
    <div className='space-y-3'>
      {segments.slice(0, 4).map((segment) => (
        <PipelineSectionBlock
          key={segment.segment_id}
          label={segment.segment_id}
        >
          <div className='flex items-center justify-between text-xs text-muted-foreground'>
            <span>{segment.segment_id}</span>
            <span>
              {formatSeconds(segment.start)} - {formatSeconds(segment.end)}
            </span>
          </div>
          <div className='mt-2 text-sm leading-6'>
            {String(segment.text || '')}
          </div>
          <div className='mt-4 grid gap-3 md:grid-cols-3'>
            <MetricBar
              label='lexical'
              value={segment.scores?.lexical}
              tone='from-rose-400 to-orange-300'
            />
            <MetricBar
              label='prosody'
              value={segment.scores?.prosody}
              tone='from-cyan-400 to-emerald-300'
            />
            <MetricBar
              label='disfluency'
              value={segment.scores?.disfluency}
              tone='from-red-400 to-rose-300'
            />
          </div>
        </PipelineSectionBlock>
      ))}
    </div>
  );
}
