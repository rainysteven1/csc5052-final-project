import { FolderOpen, UploadCloud } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { scenarioOptions } from "@/types/analysis";
import { useAnalysisStore } from "@/store/analysis-store";

export function RunFormCard() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
      description={
        mode === "live"
          ? "Upload audio, stream runtime updates over SSE, and inspect pipeline output as it arrives."
          : "Point the backend at a saved JSON result and rebuild the full pipeline as a guided replay session."
      }
      className="h-full"
      contentClassName="flex min-h-0 flex-1 flex-col gap-5"
    >
      <ScrollArea className="min-h-0 flex-1 pr-2">
        <div className="grid gap-5 pb-1">
          {mode === "live" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="audio">Audio file</Label>
                <input
                  ref={fileInputRef}
                  id="audio"
                  type="file"
                  accept=".wav,.mp3,.m4a,.flac"
                  className="hidden"
                  onChange={(event) => setAudioFile(event.target.files?.[0] || null)}
                />
                <div className="grid gap-3">
                  <Button type="button" variant="secondary" className="w-full" onClick={() => fileInputRef.current?.click()}>
                    <UploadCloud className="mr-2 h-4 w-4" />
                    {audioFile ? "Replace audio file" : "Choose audio file"}
                  </Button>
                  <div className="content-scroll min-h-[72px] rounded-[22px] border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                    <span className="break-all">{audioFile ? `${audioFile.name} · ${(audioFile.size / 1024 / 1024).toFixed(2)} MB` : "--"}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scenario">Scenario</Label>
                <select
                  id="scenario"
                  value={scenario}
                  onChange={(event) => setScenario(event.target.value)}
                  className="flex h-11 w-full rounded-[22px] border border-border/75 bg-white/72 px-4 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {scenarioOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transcript">Transcript override</Label>
                <Textarea
                  id="transcript"
                  value={transcriptOverride}
                  onChange={(event) => setTranscriptOverride(event.target.value)}
                  placeholder="Optional: paste transcript text to bypass ASR."
                  className="min-h-[180px]"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="replay-path">Replay JSON path</Label>
                <Input
                  id="replay-path"
                  value={replayPath}
                  onChange={(event) => setReplayPath(event.target.value)}
                  placeholder="/tmp/speaksure-one-round/en_test_0315.presentation.json"
                />
              </div>
              <div className="panel-block bg-white/65 text-sm leading-6 text-muted-foreground">
                <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                  <FolderOpen className="h-4 w-4" />
                  Recommended replay sample
                </div>
                <div className="content-scroll rounded-xl bg-background/70 px-3 py-2 font-mono text-xs text-foreground">
                  /tmp/speaksure-one-round/en_test_0315.presentation.json
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      <Button className="w-full" size="lg" onClick={mode === "live" ? submitLiveRun : loadReplay} disabled={isSubmitting}>
        {mode === "live"
          ? isSubmitting
            ? "Submitting..."
            : "Launch live analysis"
          : isSubmitting
            ? "Loading replay..."
            : "Load static replay"}
      </Button>
    </PageSectionCard>
  );
}
