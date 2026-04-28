import { EmptyState } from '@/components/shared/EmptyState';
import { PageSectionCard } from '@/components/shared/PageSectionCard';
import { SurfaceCalloutList } from '@/components/shared/SurfaceCalloutList';
import { SurfaceLabelSection } from '@/components/shared/SurfaceSection';
import { Badge } from '@/components/ui/badge';
import { asRecord, asStringArray } from '@/lib/analysis-helpers';
import { useAnalysisStore } from '@/store/analysis-store';

export function EvidenceDrilldownPanel() {
  const finalState = useAnalysisStore((state) => state.finalState);
  const agentOutputs =
    finalState &&
    typeof finalState.agent_outputs === 'object' &&
    finalState.agent_outputs !== null
      ? finalState.agent_outputs
      : null;

  const lexicalRows = Array.isArray(agentOutputs?.lexical)
    ? agentOutputs.lexical
    : [];
  const prosodyRows = Array.isArray(agentOutputs?.prosody)
    ? agentOutputs.prosody
    : [];
  const disfluencyRows = Array.isArray(agentOutputs?.disfluency)
    ? agentOutputs.disfluency
    : [];
  const insightGroups = buildInsightGroups(
    lexicalRows,
    prosodyRows,
    disfluencyRows
  );

  const hasContent = insightGroups.some((group) => group.rows.length > 0);

  return (
    <PageSectionCard eyebrow='Drill-down' title='Evidence insight board'>
      {!hasContent ? (
        <EmptyState title='No evidence insights yet' />
      ) : (
        <div className='grid gap-4 xl:grid-cols-3'>
          {insightGroups.map((group) => (
            <EvidenceInsightGroupCard key={group.title} group={group} />
          ))}
        </div>
      )}
    </PageSectionCard>
  );
}

type EvidenceInsightRow = {
  segmentId: string;
  score: number | null;
  lines: string[];
  chips: string[];
};

type EvidenceInsightGroup = {
  title: string;
  accent: string;
  rows: EvidenceInsightRow[];
};

function buildInsightGroups(
  lexicalRows: Array<Record<string, unknown>>,
  prosodyRows: Array<Record<string, unknown>>,
  disfluencyRows: Array<Record<string, unknown>>
): EvidenceInsightGroup[] {
  return [
    {
      title: 'Lexical interpretation',
      accent: 'bg-rose-50/90',
      rows: lexicalRows
        .filter(
          (row) =>
            row && (row.interpretation || row.rewrite_hint || row.practice_hint)
        )
        .map((row) => ({
          segmentId: String(row.segment_id || 'segment'),
          score: typeof row.score === 'number' ? row.score : null,
          lines: collectInsightLines([
            typeof row.interpretation === 'string' ? row.interpretation : null,
            typeof row.rewrite_hint === 'string'
              ? `Rewrite hint: ${row.rewrite_hint}`
              : null,
            typeof row.practice_hint === 'string'
              ? `Practice hint: ${row.practice_hint}`
              : null,
          ]),
          chips: asStringArray(row.triggers),
        })),
    },
    {
      title: 'Prosody interpretation',
      accent: 'bg-cyan-50/90',
      rows: prosodyRows
        .filter(
          (row) =>
            row &&
            (row.interpretation || row.coaching_hint || row.feedback_focus)
        )
        .map((row) => ({
          segmentId: String(row.segment_id || 'segment'),
          score: typeof row.score === 'number' ? row.score : null,
          lines: collectInsightLines([
            typeof row.interpretation === 'string' ? row.interpretation : null,
            typeof row.coaching_hint === 'string'
              ? `Coaching hint: ${row.coaching_hint}`
              : null,
            typeof row.feedback_focus === 'string'
              ? `Feedback focus: ${row.feedback_focus}`
              : null,
          ]),
          chips: asStringArray(row.explanations).slice(0, 3),
        })),
    },
    {
      title: 'Disfluency interpretation',
      accent: 'bg-amber-50/90',
      rows: disfluencyRows
        .filter(
          (row) =>
            row &&
            (row.interpretation || row.practice_hint || row.feedback_focus)
        )
        .map((row) => ({
          segmentId: String(row.segment_id || 'segment'),
          score: typeof row.score === 'number' ? row.score : null,
          lines: collectInsightLines([
            typeof row.interpretation === 'string' ? row.interpretation : null,
            typeof row.practice_hint === 'string'
              ? `Practice hint: ${row.practice_hint}`
              : null,
            typeof row.feedback_focus === 'string'
              ? `Feedback focus: ${row.feedback_focus}`
              : null,
          ]),
          chips: (Array.isArray(row.issues) ? row.issues : []).map((issue) => {
            const issueRow = asRecord(issue) || {};
            return `${String(issueRow.type || 'issue')}: ${String(issueRow.text || '')}`;
          }),
        })),
    },
  ];
}

function collectInsightLines(items: Array<string | null>) {
  return items.filter((item): item is string => Boolean(item));
}

function EvidenceInsightGroupCard({ group }: { group: EvidenceInsightGroup }) {
  return (
    <SurfaceLabelSection label={group.title}>
      <div className='space-y-3'>
        {group.rows.length ? (
          group.rows
            .slice(0, 4)
            .map((row) => (
              <EvidenceInsightRowCard
                key={`${group.title}-${row.segmentId}`}
                row={row}
                accent={group.accent}
              />
            ))
        ) : (
          <div className='console-surface-dashed px-4 py-5 text-sm text-muted-foreground'>
            No rows available.
          </div>
        )}
      </div>
    </SurfaceLabelSection>
  );
}

function EvidenceInsightRowCard({
  row,
  accent,
}: {
  row: EvidenceInsightRow;
  accent: string;
}) {
  return (
    <div className={`rounded-[20px] ${accent} p-3`}>
      <div className='flex items-center justify-between gap-3'>
        <div className='text-sm font-medium'>{row.segmentId}</div>
        <Badge variant='outline'>
          {row.score != null ? row.score.toFixed(3) : '--'}
        </Badge>
      </div>
      <SurfaceCalloutList
        items={row.lines}
        className='mt-3'
        itemClassName='glass-panel-soft px-3 py-2'
      />
      {row.chips.length ? (
        <div className='mt-3 flex flex-wrap gap-2'>
          {row.chips.slice(0, 4).map((chip) => (
            <Badge
              key={`${row.segmentId}-${chip}`}
              variant='outline'
              className='glass-chip-strong'
            >
              {chip}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
