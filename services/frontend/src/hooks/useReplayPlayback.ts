import { useEffect } from 'react';

import { useAnalysisStore } from '@/store/analysis-store';

export function useReplayPlayback() {
  const mode = useAnalysisStore((state) => state.mode);
  const isReplayPlaying = useAnalysisStore((state) => state.isReplayPlaying);
  const eventsLength = useAnalysisStore((state) => state.events.length);
  const replayCursor = useAnalysisStore((state) => state.replayCursor);
  const advanceReplayPlayback = useAnalysisStore(
    (state) => state.advanceReplayPlayback
  );

  useEffect(() => {
    if (mode !== 'replay' || !isReplayPlaying || eventsLength === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      advanceReplayPlayback();
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [
    advanceReplayPlayback,
    eventsLength,
    isReplayPlaying,
    mode,
    replayCursor,
  ]);
}
