import { ResultInfoBlock } from '@/components/results/ResultInfoBlock';

type ResultsTranscriptColumnProps = {
  transcript: string;
};

export function ResultsTranscriptColumn({
  transcript,
}: ResultsTranscriptColumnProps) {
  return (
    <div className='grid gap-4'>
      <ResultInfoBlock
        label='Transcript snapshot'
        value={transcript || '--'}
        tone='console-surface min-h-[220px]'
      />
    </div>
  );
}
