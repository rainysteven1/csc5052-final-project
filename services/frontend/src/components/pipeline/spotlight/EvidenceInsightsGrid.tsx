import { PipelineSectionBlock } from '@/components/pipeline/PipelineSectionBlock';
import { SpotlightCalloutList } from '@/components/pipeline/spotlight/SpotlightPrimitives';

type EvidenceInsight = {
  title: string;
  lines: string[];
};

type EvidenceInsightsGridProps = {
  insights: EvidenceInsight[];
};

export function EvidenceInsightsGrid({ insights }: EvidenceInsightsGridProps) {
  if (!insights.length) {
    return null;
  }

  return (
    <div className='grid gap-4 xl:grid-cols-2'>
      {insights.map((insight) => (
        <PipelineSectionBlock key={insight.title} label={insight.title}>
          <SpotlightCalloutList items={insight.lines} />
        </PipelineSectionBlock>
      ))}
    </div>
  );
}
