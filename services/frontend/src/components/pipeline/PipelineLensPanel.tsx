import type { PipelineView } from '@/components/pipeline/PipelineViewTabs';
import { PageSectionCard } from '@/components/shared/PageSectionCard';
import {
  StatCardGrid,
  type StatCardItem,
} from '@/components/shared/StatCardGrid';
import { prettifyNode } from '@/lib/analysis-helpers';
import { useAnalysisStore } from '@/store/analysis-store';
import { pipelineOrder } from '@/types/analysis';

const lensConfig: Record<PipelineView, { title: string; eyebrow: string }> = {
  overview: { title: 'Overview lens', eyebrow: 'Coverage' },
  evidence: { title: 'Evidence lens', eyebrow: 'Signals' },
  timeline: { title: 'Timeline lens', eyebrow: 'Stream' },
};

export function PipelineLensPanel({ view }: { view: PipelineView }) {
  const mode = useAnalysisStore((state) => state.mode);
  const job = useAnalysisStore((state) => state.job);
  const activeNode = useAnalysisStore((state) => state.activeNode);
  const events = useAnalysisStore((state) => state.events);
  const replayCursor = useAnalysisStore((state) => state.replayCursor);
  const finalState = useAnalysisStore((state) => state.finalState);

  const agentOutputs =
    finalState &&
    typeof finalState.agent_outputs === 'object' &&
    finalState.agent_outputs !== null
      ? finalState.agent_outputs
      : null;

  const completedSteps = job?.completed_steps || 0;
  const totalSteps = job?.total_steps || pipelineOrder.length;

  const cardsByView: Record<PipelineView, StatCardItem[]> = {
    overview: [
      {
        label: 'Stage coverage',
        value: `${completedSteps}/${totalSteps}`,
        meta: 'completed / total',
      },
      {
        label: 'Active node',
        value: prettifyNode(job?.current_node || activeNode),
        meta: mode === 'live' ? 'live focus' : 'replay focus',
      },
      {
        label: 'Event flow',
        value: `${events.length}`,
        meta:
          mode === 'live'
            ? 'captured events'
            : `frame ${events.length ? replayCursor + 1 : 0}`,
      },
    ],
    evidence: [
      {
        label: 'Lexical rows',
        value: String(
          Array.isArray(agentOutputs?.lexical) ? agentOutputs.lexical.length : 0
        ),
        meta: 'rewrite + trigger rows',
      },
      {
        label: 'Prosody rows',
        value: String(
          Array.isArray(agentOutputs?.prosody) ? agentOutputs.prosody.length : 0
        ),
        meta: 'delivery signal rows',
      },
      {
        label: 'Disfluency rows',
        value: String(
          Array.isArray(agentOutputs?.disfluency)
            ? agentOutputs.disfluency.length
            : 0
        ),
        meta: 'fluency issue rows',
      },
    ],
    timeline: [
      {
        label: 'Stream mode',
        value: mode === 'live' ? 'SSE live' : 'Replay',
        meta: mode === 'live' ? 'backend event feed' : 'static playback',
      },
      {
        label: 'Visible frame',
        value:
          mode === 'replay'
            ? `${events.length ? replayCursor + 1 : 0}/${events.length}`
            : `${events.length}`,
        meta: mode === 'replay' ? 'current / total' : 'captured events',
      },
      {
        label: 'Node context',
        value: prettifyNode(job?.current_node || activeNode),
        meta: 'paired spotlight context',
      },
    ],
  };

  const config = lensConfig[view];

  return (
    <PageSectionCard eyebrow={config.eyebrow} title={config.title}>
      <StatCardGrid items={cardsByView[view]} />
    </PageSectionCard>
  );
}
