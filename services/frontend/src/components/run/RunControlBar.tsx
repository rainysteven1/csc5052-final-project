import { RunModeTabs } from '@/components/run/RunModeTabs';
import { ControlStatCard } from '@/components/shared/ControlStatCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { WorkspaceControlBar } from '@/components/shared/WorkspaceControlBar';
import { isFakeDeployment } from '@/lib/runtime-config';
import { getExplanationLanguageShortLabel } from '@/lib/theme';
import { useAnalysisStore } from '@/store/analysis-store';
import { useThemeStore } from '@/store/theme-store';

function deriveSourceLabel(
  mode: 'live' | 'replay',
  audioName: string | null,
  replayPath: string
) {
  if (mode === 'live') {
    if (isFakeDeployment) {
      return 'Showcase preset';
    }
    return audioName || 'No audio selected';
  }

  const trimmed = replayPath.trim();
  if (!trimmed) {
    return 'No replay path';
  }

  const parts = trimmed.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || trimmed;
}

export function RunControlBar() {
  const mode = useAnalysisStore((state) => state.mode);
  const scenario = useAnalysisStore((state) => state.scenario);
  const audioFile = useAnalysisStore((state) => state.audioFile);
  const replayPath = useAnalysisStore((state) => state.replayPath);
  const job = useAnalysisStore((state) => state.job);
  const switchMode = useAnalysisStore((state) => state.switchMode);
  const explanationLanguage = useThemeStore(
    (state) => state.explanationLanguage
  );

  const sourceLabel = deriveSourceLabel(
    mode,
    audioFile?.name || null,
    replayPath
  );
  const statusLabel =
    mode === 'live' ? job?.status || 'idle' : job?.status || 'ready';

  return (
    <WorkspaceControlBar
      tabs={<RunModeTabs active={mode} onChange={switchMode} />}
      statsClassName='sm:grid-cols-4'
      stats={
        <>
          <ControlStatCard label='Scenario' value={scenario} />
          <ControlStatCard label='Source' value={sourceLabel} />
          <ControlStatCard
            label='Output'
            value={getExplanationLanguageShortLabel(explanationLanguage)}
            meta={
              explanationLanguage === 'en'
                ? 'English explanations'
                : 'Chinese explanations'
            }
          />
          <ControlStatCard
            label='Status'
            value={
              <div className='flex items-center justify-between gap-3'>
                <StatusBadge status={job?.status} label={statusLabel} />
                <span className='ui-label-xs text-muted-foreground'>
                  {isFakeDeployment
                    ? 'Fake showcase'
                    : mode === 'live'
                      ? 'SSE stream'
                      : 'Static replay'}
                </span>
              </div>
            }
          />
        </>
      }
    />
  );
}
