import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

import { SectionEyebrow } from "@/components/shared/SectionEyebrow";
import { Button } from "@/components/ui/button";
import { useAnalysisStore } from "@/store/analysis-store";

export function ReplayControls() {
  const mode = useAnalysisStore((state) => state.mode);
  const events = useAnalysisStore((state) => state.events);
  const replayCursor = useAnalysisStore((state) => state.replayCursor);
  const isReplayPlaying = useAnalysisStore((state) => state.isReplayPlaying);
  const seekReplay = useAnalysisStore((state) => state.seekReplay);
  const stepReplay = useAnalysisStore((state) => state.stepReplay);
  const toggleReplayPlayback = useAnalysisStore((state) => state.toggleReplayPlayback);

  if (mode !== "replay" || events.length === 0) {
    return (
      <div className="console-surface-dashed flex min-h-[112px] items-center px-4 text-sm text-muted-foreground">
        Replay controls will activate here once a replay file is loaded.
      </div>
    );
  }

  const currentEvent = events[replayCursor];

  return (
    <div className="console-surface grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_360px] md:items-center">
      <div className="min-w-0">
        <SectionEyebrow>Replay controls</SectionEyebrow>
        <div className="content-scroll mt-2 max-h-16 pr-1 text-sm text-muted-foreground">
          Frame {replayCursor + 1} / {events.length} · {currentEvent?.message || "Ready"}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Button variant="secondary" size="sm" className="w-full" onClick={() => seekReplay("first")}>
          <SkipBack className="mr-1 h-4 w-4" />
          First
        </Button>
        <Button variant="secondary" size="sm" className="w-full" onClick={() => stepReplay(-1)}>
          <SkipBack className="mr-1 h-4 w-4" />
          Prev
        </Button>
        <Button size="sm" className="w-full" onClick={toggleReplayPlayback}>
          {isReplayPlaying ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
          {isReplayPlaying ? "Pause" : "Play"}
        </Button>
        <Button variant="secondary" size="sm" className="w-full" onClick={() => stepReplay(1)}>
          Next
          <SkipForward className="ml-1 h-4 w-4" />
        </Button>
        <Button variant="secondary" size="sm" className="col-span-2 w-full sm:col-span-1" onClick={() => seekReplay("last")}>
          Last
          <SkipForward className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
