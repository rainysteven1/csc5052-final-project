import { MetricBar } from '@/components/pipeline';
import type { SegmentLike } from '@/types/analysis';

type SegmentScoreGridProps = {
  segment: SegmentLike;
};

export function SegmentScoreGrid({ segment }: SegmentScoreGridProps) {
  return (
    <div className='grid gap-3 lg:grid-cols-4'>
      <MetricBar
        label='Lexical risk'
        value={segment.scores?.lexical}
        tone='from-rose-400 to-orange-300'
      />
      <MetricBar
        label='Prosody risk'
        value={segment.scores?.prosody}
        tone='from-cyan-400 to-emerald-300'
      />
      <MetricBar
        label='Disfluency risk'
        value={segment.scores?.disfluency}
        tone='from-red-400 to-rose-300'
      />
      <MetricBar
        label='Combined risk'
        value={segment.scores?.final}
        tone='from-indigo-400 to-slate-300'
      />
    </div>
  );
}
