import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { RunLiveFields } from "@/components/run/RunLiveFields";
import { RunReplayFields } from "@/components/run/RunReplayFields";
import { RunSubmitButton } from "@/components/run/RunSubmitButton";
import { useAnalysisStore } from "@/store/analysis-store";

export function RunFormCard() {
  const mode = useAnalysisStore((state) => state.mode);
  const audioFile = useAnalysisStore((state) => state.audioFile);
  const scenario = useAnalysisStore((state) => state.scenario);
  const transcriptOverride = useAnalysisStore((state) => state.transcriptOverride);
  const replayPath = useAnalysisStore((state) => state.replayPath);
  const isSubmitting = useAnalysisStore((state) => state.isSubmitting);
  const setAudioFile = useAnalysisStore((state) => state.setAudioFile);
  const setScenario = useAnalysisStore((state) => state.setScenario);
  const setTranscriptOverride = useAnalysisStore((state) => state.setTranscriptOverride);
  const setReplayPath = useAnalysisStore((state) => state.setReplayPath);
  const submitLiveRun = useAnalysisStore((state) => state.submitLiveRun);
  const loadReplay = useAnalysisStore((state) => state.loadReplay);

  return (
    <PageSectionCard
      eyebrow="Input"
      title={mode === "live" ? "Start a live run" : "Load a replay file"}
      className="h-full"
      contentClassName="flex min-h-0 flex-1 flex-col gap-5"
    >
      <div className="grid gap-5">
        {mode === "live" ? (
          <RunLiveFields
            audioFile={audioFile}
            scenario={scenario}
            transcriptOverride={transcriptOverride}
            onAudioChange={setAudioFile}
            onScenarioChange={setScenario}
            onTranscriptChange={setTranscriptOverride}
          />
        ) : (
          <RunReplayFields replayPath={replayPath} onReplayPathChange={setReplayPath} />
        )}
      </div>

      <RunSubmitButton mode={mode} isSubmitting={isSubmitting} onClick={mode === "live" ? submitLiveRun : loadReplay} />
    </PageSectionCard>
  );
}
