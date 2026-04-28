import { ResultInfoBlock } from '@/components/results/ResultInfoBlock';

type SegmentLinkedCoachingGridProps = {
  problem: string;
  rewrite: string;
  practice: string;
};

export function SegmentLinkedCoachingGrid({
  problem,
  rewrite,
  practice,
}: SegmentLinkedCoachingGridProps) {
  return (
    <div className='mt-3 grid gap-3 xl:grid-cols-3'>
      <ResultInfoBlock label='Linked coaching problem' value={problem} />
      <ResultInfoBlock
        label='Linked rewrite'
        value={rewrite}
        tone='tone-accent-soft'
      />
      <ResultInfoBlock
        label='Practice follow-up'
        value={practice}
        tone='tone-secondary-muted'
      />
    </div>
  );
}
