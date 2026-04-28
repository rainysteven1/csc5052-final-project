import { RunLiveFields } from '@/components/run/RunLiveFields';
import { RunReplayFields } from '@/components/run/RunReplayFields';
import { RunSubmitButton } from '@/components/run/RunSubmitButton';
import { PageSectionCard } from '@/components/shared/PageSectionCard';
import { isFakeDeployment } from '@/lib/runtime-config';
import { useAnalysisStore } from '@/store/analysis-store';

export function RunFormCard() {
  const mode = useAnalysisStore((state) => state.mode);
  const audioFile = useAnalysisStore((state) => state.audioFile);
  const scenario = useAnalysisStore((state) => state.scenario);
  const transcriptOverride = useAnalysisStore(
    (state) => state.transcriptOverride
  );
  const replayPath = useAnalysisStore((state) => state.replayPath);
  const demoCatalog = useAnalysisStore((state) => state.demoCatalog);
  const isDemoCatalogLoading = useAnalysisStore(
    (state) => state.isDemoCatalogLoading
  );
  const isSubmitting = useAnalysisStore((state) => state.isSubmitting);
  const setAudioFile = useAnalysisStore((state) => state.setAudioFile);
  const setScenario = useAnalysisStore((state) => state.setScenario);
  const setTranscriptOverride = useAnalysisStore(
    (state) => state.setTranscriptOverride
  );
  const setReplayPath = useAnalysisStore((state) => state.setReplayPath);
  const selectReplayDemo = useAnalysisStore((state) => state.selectReplayDemo);
  const launchDemoReplay = useAnalysisStore((state) => state.launchDemoReplay);
  const launchDemoLive = useAnalysisStore((state) => state.launchDemoLive);
  const submitLiveRun = useAnalysisStore((state) => state.submitLiveRun);
  const loadReplay = useAnalysisStore((state) => state.loadReplay);

  return (
    <PageSectionCard
      eyebrow='Input'
      title={
        isFakeDeployment
          ? mode === 'live'
            ? 'Launch a showcase run'
            : 'Open a showcase replay'
          : mode === 'live'
            ? 'Start a live run'
            : 'Load a replay file'
      }
      className='h-full'
      contentClassName='flex min-h-0 flex-1 flex-col gap-5'
    >
      <div className='grid gap-5'>
        <RunReplayFields
          mode={mode}
          replayPath={replayPath}
          scenario={scenario}
          demoCatalog={demoCatalog}
          isDemoCatalogLoading={isDemoCatalogLoading}
          showShowcaseGallery={isFakeDeployment}
          showReplayPathField={!isFakeDeployment}
          onReplayPathChange={setReplayPath}
          onReplayDemoSelect={selectReplayDemo}
          onLaunchReplayDemo={launchDemoReplay}
          onLaunchLiveDemo={launchDemoLive}
        />

        {mode === 'live' && !isFakeDeployment ? (
          <RunLiveFields
            audioFile={audioFile}
            scenario={scenario}
            transcriptOverride={transcriptOverride}
            onAudioChange={setAudioFile}
            onScenarioChange={setScenario}
            onTranscriptChange={setTranscriptOverride}
          />
        ) : null}
      </div>

      {!(isFakeDeployment && mode === 'live') ? (
        <RunSubmitButton
          mode={mode}
          isSubmitting={isSubmitting}
          onClick={mode === 'live' ? submitLiveRun : loadReplay}
        />
      ) : null}
    </PageSectionCard>
  );
}
