import { PageSectionCard } from '@/components/shared/PageSectionCard';
import {
  StatCardGrid,
  type StatCardItem,
} from '@/components/shared/StatCardGrid';
import { isFakeDeployment } from '@/lib/runtime-config';
import { useAnalysisStore } from '@/store/analysis-store';
import { defaultReplayPath } from '@/types/analysis';

export function RunLensPanel() {
  const mode = useAnalysisStore((state) => state.mode);
  const scenario = useAnalysisStore((state) => state.scenario);
  const audioFile = useAnalysisStore((state) => state.audioFile);
  const replayPath = useAnalysisStore((state) => state.replayPath);
  const transcriptOverride = useAnalysisStore(
    (state) => state.transcriptOverride
  );
  const job = useAnalysisStore((state) => state.job);

  const usingDemoReplay =
    mode === 'replay' && replayPath.trim().startsWith('demo:');
  const sourceValue =
    mode === 'live'
      ? isFakeDeployment
        ? 'showcase preset'
        : audioFile?.name || 'no audio selected'
      : replayPath.trim() || defaultReplayPath;

  const transcriptMeta = transcriptOverride.trim()
    ? `${transcriptOverride.trim().split(/\s+/).length} words`
    : 'ASR will remain enabled';

  const items: StatCardItem[] = [
    {
      label: 'Mode',
      value: mode === 'live' ? 'Live analysis' : 'Replay load',
      meta: job?.status || 'idle',
    },
    {
      label: 'Scenario',
      value: scenario,
      meta:
        mode === 'live'
          ? isFakeDeployment
            ? 'selected from showcase presets'
            : 'applies to live coaching'
          : 'used for replay inspection',
    },
    {
      label: 'Source',
      value: sourceValue,
      meta:
        mode === 'live'
          ? isFakeDeployment
            ? 'driven by showcase catalog'
            : audioFile
              ? 'local upload ready'
              : 'waiting for upload'
          : usingDemoReplay
            ? 'catalog preset selected'
            : 'JSON replay path',
    },
  ];

  if (!isFakeDeployment) {
    items.push({
      label: 'Transcript override',
      value: transcriptOverride.trim() ? 'enabled' : 'disabled',
      meta: transcriptMeta,
    });
  }

  return (
    <PageSectionCard eyebrow='Workspace' title='Run lens'>
      <StatCardGrid
        items={items}
        columnsClassName={
          isFakeDeployment
            ? 'grid gap-3 lg:grid-cols-3'
            : 'grid gap-3 lg:grid-cols-4'
        }
      />
    </PageSectionCard>
  );
}
