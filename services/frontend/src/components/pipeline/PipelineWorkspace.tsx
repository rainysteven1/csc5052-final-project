import { PipelineLensPanel } from '@/components/pipeline/PipelineLensPanel';
import type { PipelineView } from '@/components/pipeline/PipelineViewTabs';
import { getPipelineWorkspaceColumns } from '@/components/pipeline/PipelineWorkspaceColumns';
import { ProgressOverview } from '@/components/pipeline/ProgressOverview';
import { WorkspaceColumns } from '@/components/shared/WorkspaceColumns';

type PipelineWorkspaceProps = {
  view: PipelineView;
};

export function PipelineWorkspace({ view }: PipelineWorkspaceProps) {
  const columns = getPipelineWorkspaceColumns({ view });

  return (
    <div className='grid gap-5'>
      {view === 'overview' ? (
        <ProgressOverview />
      ) : (
        <PipelineLensPanel view={view} />
      )}
      <WorkspaceColumns
        left={columns.left}
        right={columns.right}
        columnsClassName={
          columns.hasRightColumn ? 'xl:grid-cols-[1.12fr_0.88fr]' : undefined
        }
      />
    </div>
  );
}
