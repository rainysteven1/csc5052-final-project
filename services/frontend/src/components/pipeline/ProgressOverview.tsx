import { ActiveStagePanel } from '@/components/pipeline/ActiveStagePanel';
import { LiveRuntimePanel } from '@/components/pipeline/LiveRuntimePanel';
import { ReplayControls } from '@/components/pipeline/ReplayControls';
import { RuntimeTile } from '@/components/pipeline/RuntimeTile';
import { PageSectionCard } from '@/components/shared/PageSectionCard';
import { asRecord, prettifyNode } from '@/lib/analysis-helpers';
import { useAnalysisStore } from '@/store/analysis-store';
import { pipelineOrder } from '@/types/analysis';

export function ProgressOverview() {
  const mode = useAnalysisStore((state) => state.mode);
  const job = useAnalysisStore((state) => state.job);
  const events = useAnalysisStore((state) => state.events);
  const activeNode = useAnalysisStore((state) => state.activeNode);
  const activePayload = useAnalysisStore((state) => state.activePayload);
  const replayCursor = useAnalysisStore((state) => state.replayCursor);

  const latest = events.length ? events[events.length - 1] : undefined;
  const payload = asRecord(activePayload) || {};
  const activeSubstep =
    typeof payload.substep === 'string' ? payload.substep : null;
  const completedSteps = job?.completed_steps || 0;
  const totalSteps = job?.total_steps || pipelineOrder.length;
  const progressPercent =
    latest?.progress != null
      ? latest.progress * 100
      : totalSteps
        ? (completedSteps / totalSteps) * 100
        : 0;

  return (
    <PageSectionCard
      eyebrow='Runtime'
      title='Execution strip'
      className='h-full'
      contentClassName='flex min-h-0 flex-1 flex-col gap-4'
    >
      <div className='grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] xl:items-start'>
        <div className='grid gap-4'>
          <ActiveStagePanel
            activeNode={activeNode}
            activeSubstep={activeSubstep}
            progressPercent={progressPercent}
            completedSteps={job?.completed_steps || 0}
            totalSteps={job?.total_steps}
            mode={mode}
            eventsCount={events.length}
            replayCursor={replayCursor}
          />

          <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
            <RuntimeTile
              label='Stage coverage'
              value={`${completedSteps}/${totalSteps}`}
              detail='completed / total stages'
            />
            <RuntimeTile
              label='Active node'
              value={prettifyNode(job?.current_node || activeNode)}
              detail={mode === 'live' ? 'live focus' : 'replay focus'}
            />
            <RuntimeTile
              label='Event flow'
              value={
                mode === 'live'
                  ? `${events.length}`
                  : `${events.length ? replayCursor + 1 : 0}/${events.length}`
              }
              detail={
                mode === 'live' ? 'captured events' : 'visible frame / total'
              }
            />
            <RuntimeTile
              label='Latest event'
              value={
                latest?.event_type
                  ? prettifyNode(latest.event_type)
                  : 'Awaiting stream'
              }
              detail={
                latest?.message ||
                (mode === 'live'
                  ? 'No SSE event received yet.'
                  : 'Load a replay file to populate the runtime timeline.')
              }
            />
            <RuntimeTile
              label='Analysis ID'
              value={job?.analysis_id || 'n/a'}
              detail={job?.audio_filename || 'No audio attached'}
            />
            <RuntimeTile
              label='Trace link'
              value={job?.request_id || job?.trace_id || 'n/a'}
              detail={
                job?.trace_id
                  ? `trace ${job.trace_id}`
                  : 'Trace metadata will appear once the backend reports it.'
              }
            />
          </div>
        </div>

        {mode === 'replay' ? (
          <ReplayControls />
        ) : (
          <LiveRuntimePanel
            latestMessage={latest?.message || null}
            latestTime={latest?.created_at || null}
          />
        )}
      </div>
    </PageSectionCard>
  );
}
