import { NodeSpotlight } from '@/components/pipeline/NodeSpotlight';
import { PipelineInfoBlock } from '@/components/pipeline/PipelineInfoBlock';
import { PipelineSectionBlock } from '@/components/pipeline/PipelineSectionBlock';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageSectionCard } from '@/components/shared/PageSectionCard';
import { SelectionPill } from '@/components/shared/SelectionPill';
import { SurfaceCalloutList } from '@/components/shared/SurfaceCalloutList';
import {
  buildNodeDetails,
  getActiveSubstep,
  getWorkflowSubsteps,
  normalizeAnalysisState,
  prettifyNode,
} from '@/lib/analysis-helpers';
import { useAnalysisStore } from '@/store/analysis-store';

export function NodeDetailPanel() {
  const activeNode = useAnalysisStore((state) => state.activeNode);
  const finalState = useAnalysisStore((state) => state.finalState);
  const activePayload = useAnalysisStore((state) => state.activePayload);
  const detail = buildNodeDetails(activeNode, finalState, activePayload);
  const stateFromPayload =
    normalizeAnalysisState(activePayload?.state) || finalState;
  const substeps = getWorkflowSubsteps(stateFromPayload, activeNode);
  const activeSubstep = getActiveSubstep(activePayload, activeNode);

  return (
    <PageSectionCard
      eyebrow='Spotlight'
      title={detail.title}
      contentClassName='flex flex-col gap-4'
    >
      <div className='grid gap-3 sm:grid-cols-2'>
        {detail.stats.length > 0 ? (
          detail.stats.map((item) => (
            <PipelineInfoBlock
              key={item.label}
              label={item.label}
              value={item.value}
              valueClassName='font-display text-2xl leading-none'
            />
          ))
        ) : (
          <div className='sm:col-span-2'>
            <EmptyState title='No stage stats' className='min-h-[120px]' />
          </div>
        )}
      </div>

      <PipelineSectionBlock label='Stage takeaways'>
        {substeps.length ? (
          <div className='mb-4 flex flex-wrap gap-2'>
            {substeps.map((substep) => (
              <SelectionPill
                key={substep}
                label={prettifyNode(substep)}
                active={activeSubstep === substep}
              />
            ))}
          </div>
        ) : null}
        <SurfaceCalloutList items={detail.bullets} />
      </PipelineSectionBlock>

      <PipelineSectionBlock label='Visual spotlight' bodyClassName='pr-1'>
        <NodeSpotlight
          node={activeNode}
          result={finalState}
          payload={activePayload}
        />
      </PipelineSectionBlock>
    </PageSectionCard>
  );
}
