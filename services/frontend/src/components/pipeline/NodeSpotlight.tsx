import {
  CoachingSpotlight,
  EvidenceSpotlight,
  FinalizeSpotlight,
  InputSpotlight,
} from '@/components/pipeline/spotlight';
import {
  asRecord,
  getSelectedNodeSnapshot,
  normalizeAnalysisState,
} from '@/lib/analysis-helpers';
import type { AnalysisStateResult, NodeName } from '@/types/analysis';

type NodeSpotlightProps = {
  node: NodeName;
  result: AnalysisStateResult | null;
  payload: Record<string, unknown> | null;
};

export function NodeSpotlight({ node, result, payload }: NodeSpotlightProps) {
  const snapshot = getSelectedNodeSnapshot(node, result, payload);
  const current = normalizeAnalysisState(payload?.state) || result;
  const currentMeta = asRecord(current?.meta) || {};
  const currentAgentOutputs = asRecord(current?.agent_outputs) || {};

  if (!snapshot || !current) {
    return <div className='text-sm text-muted-foreground'>--</div>;
  }

  if (node === 'input') {
    return (
      <InputSpotlight
        snapshot={snapshot as Record<string, unknown>}
        current={current}
        currentMeta={currentMeta}
      />
    );
  }

  if (node === 'evidence') {
    return (
      <EvidenceSpotlight
        snapshot={snapshot as Record<string, unknown>}
        current={current}
        currentAgentOutputs={currentAgentOutputs}
      />
    );
  }

  if (node === 'coaching') {
    return (
      <CoachingSpotlight
        snapshot={snapshot as Record<string, unknown>}
        currentAgentOutputs={currentAgentOutputs}
        currentResult={current.result}
      />
    );
  }

  return (
    <FinalizeSpotlight
      snapshot={snapshot as Record<string, unknown>}
      current={current}
      currentMeta={currentMeta}
    />
  );
}
