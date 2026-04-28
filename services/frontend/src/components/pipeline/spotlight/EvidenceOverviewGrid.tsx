import { PipelineSectionBlock } from '@/components/pipeline/PipelineSectionBlock';
import { SpotlightChipList } from '@/components/pipeline/spotlight/SpotlightPrimitives';
import { SurfaceCalloutList } from '@/components/shared/SurfaceCalloutList';
import { asRecord, asStringArray } from '@/lib/analysis-helpers';

type EvidenceOverviewGridProps = {
  lexical: Array<Record<string, unknown>>;
  prosody: Array<Record<string, unknown>>;
  disfluency: Array<Record<string, unknown>>;
  context: Record<string, unknown>;
  evidenceSummary: Record<string, unknown>;
  scenario: string;
  topLexical: unknown[];
  riskSegments: unknown[];
};

export function EvidenceOverviewGrid({
  lexical,
  prosody,
  disfluency,
  context,
  evidenceSummary,
  scenario,
  topLexical,
  riskSegments,
}: EvidenceOverviewGridProps) {
  const prosodyRows = [
    ['Avg lexical', averageScore(lexical)],
    ['Avg prosody', averageScore(prosody)],
    ['Avg disfluency', averageScore(disfluency)],
  ] as const;

  return (
    <>
      <div className='grid gap-4 xl:grid-cols-2'>
        <PipelineSectionBlock label='Lexical triggers'>
          <SpotlightChipList
            items={lexical
              .flatMap((row) => asStringArray(row.triggers))
              .slice(0, 10)}
          />
        </PipelineSectionBlock>
        <PipelineSectionBlock label='Disfluency issues'>
          <SpotlightChipList
            items={disfluency
              .flatMap((row) => (Array.isArray(row.issues) ? row.issues : []))
              .slice(0, 8)
              .map(
                (issue: Record<string, unknown>) =>
                  `${String(issue.type)} · ${String(issue.text)}`
              )}
          />
        </PipelineSectionBlock>
      </div>

      <PipelineSectionBlock label='Prosody'>
        <div className='overflow-hidden rounded-[16px] border border-border/65 bg-secondary/18'>
          <div className='grid grid-cols-3 border-b border-border/60'>
            {prosodyRows.map(([label]) => (
              <div
                key={label}
                className='px-3 py-2 text-center ui-label-xs text-muted-foreground'
              >
                {label}
              </div>
            ))}
          </div>
          <div className='grid grid-cols-3'>
            {prosodyRows.map(([label, value]) => (
              <div
                key={`${label}-value`}
                className='border-r border-border/60 px-3 py-2 text-center text-sm font-medium leading-5 last:border-r-0'
              >
                {typeof value === 'number' ? value.toFixed(2) : '--'}
              </div>
            ))}
          </div>
        </div>
      </PipelineSectionBlock>

      <PipelineSectionBlock label='Context'>
        <div className='space-y-3'>
          <div className='overflow-hidden rounded-[16px] border border-border/65 bg-secondary/18'>
            <div className='grid grid-cols-2 border-b border-border/60'>
              {['Scenario', 'Evidence version'].map((label) => (
                <div
                  key={label}
                  className='px-3 py-2 text-center ui-label-xs text-muted-foreground'
                >
                  {label}
                </div>
              ))}
            </div>
            <div className='grid grid-cols-2'>
              <div className='border-r border-border/60 px-3 py-2 text-center text-sm font-medium leading-5'>
                {String(context.scenario || scenario)}
              </div>
              <div className='px-3 py-2 text-center text-sm font-medium leading-5'>
                {String(evidenceSummary.version || 'n/a')}
              </div>
            </div>
          </div>
          <SurfaceCalloutList
            items={asStringArray(context.style_constraints).slice(0, 3)}
          />
        </div>
      </PipelineSectionBlock>

      <div className='grid gap-4 xl:grid-cols-2'>
        <PipelineSectionBlock label='Top lexical signals'>
          <SpotlightChipList
            items={topLexical.slice(0, 4).map((item) => {
              const row = asRecord(item) || {};
              return `${String(row.label || 'n/a')} × ${String(row.count || 0)}`;
            })}
          />
        </PipelineSectionBlock>
        <PipelineSectionBlock label='Risk hotspots'>
          <SurfaceCalloutList
            items={riskSegments.slice(0, 3).map((item, index) => {
              const row = asRecord(item) || {};
              return `${String(row.segment_id || `segment-${index + 1}`)} · ${String(row.score || '0')} · ${asStringArray(row.reasons).join(' / ')}`;
            })}
          />
        </PipelineSectionBlock>
      </div>
    </>
  );
}

function averageScore(rows: Array<Record<string, unknown>>) {
  const scores = rows
    .map((row) => (typeof row.score === 'number' ? row.score : 0))
    .filter(Number.isFinite);
  if (!scores.length) {
    return 0;
  }
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}
