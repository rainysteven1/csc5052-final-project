import { PageSectionCard } from '@/components/shared/PageSectionCard';
import {
  StatCardGrid,
  type StatCardItem,
} from '@/components/shared/StatCardGrid';
import {
  asRecord,
  buildResultSummary,
  prettifyNode,
} from '@/lib/analysis-helpers';
import { useAnalysisStore } from '@/store/analysis-store';

export function DebugLensPanel() {
  const finalState = useAnalysisStore((state) => state.finalState);
  const activePayload = useAnalysisStore((state) => state.activePayload);
  const job = useAnalysisStore((state) => state.job);
  const activeNode = useAnalysisStore((state) => state.activeNode);
  const events = useAnalysisStore((state) => state.events);
  const summary = buildResultSummary(finalState, job);
  const payload = asRecord(activePayload) || {};
  const items: StatCardItem[] = [
    {
      label: 'Request',
      value: summary.requestId || 'n/a',
      meta: summary.scenario || 'scenario pending',
    },
    {
      label: 'Active node',
      value: prettifyNode(job?.current_node || activeNode),
      meta: `${events.length} captured events`,
    },
    {
      label: 'State fields',
      value: String(Object.keys(finalState || {}).length),
      meta: 'root keys in final state',
    },
    {
      label: 'Event payload fields',
      value: String(Object.keys(payload).length),
      meta: 'active event payload keys',
    },
  ];

  return (
    <PageSectionCard eyebrow='Inspection' title='Debug lens'>
      <StatCardGrid
        items={items}
        columnsClassName='grid gap-3 lg:grid-cols-4'
      />
    </PageSectionCard>
  );
}
