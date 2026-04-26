import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { FeedbackDeck } from "@/components/results/FeedbackDeck";
import { ResultsHero } from "@/components/results/ResultsHero";
import { SegmentResultsPanel } from "@/components/results/SegmentResultsPanel";
import { buildResultSummary } from "@/lib/analysis-helpers";
import { useAnalysisStore } from "@/store/analysis-store";

export function ResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const finalState = useAnalysisStore((state) => state.finalState);
  const job = useAnalysisStore((state) => state.job);
  const summary = buildResultSummary(finalState, job);
  const feedbackIds = summary.feedbackRows.map((row) => String(row.segment_id || "")).filter(Boolean);
  const segmentIds = summary.segmentResults.map((segment) => segment.segment_id);
  const feedbackParam = searchParams.get("feedback");
  const segmentParam = searchParams.get("segment");
  const activeFeedbackId = feedbackParam && feedbackIds.includes(feedbackParam) ? feedbackParam : feedbackIds[0] || null;
  const activeSegmentId =
    segmentParam && segmentIds.includes(segmentParam)
      ? segmentParam
      : activeFeedbackId && segmentIds.includes(activeFeedbackId)
        ? activeFeedbackId
        : segmentIds[0] || null;

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    let changed = false;

    if (activeFeedbackId) {
      if (nextParams.get("feedback") !== activeFeedbackId) {
        nextParams.set("feedback", activeFeedbackId);
        changed = true;
      }
    } else if (nextParams.has("feedback")) {
      nextParams.delete("feedback");
      changed = true;
    }

    if (activeSegmentId) {
      if (nextParams.get("segment") !== activeSegmentId) {
        nextParams.set("segment", activeSegmentId);
        changed = true;
      }
    } else if (nextParams.has("segment")) {
      nextParams.delete("segment");
      changed = true;
    }

    if (changed) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeFeedbackId, activeSegmentId, searchParams, setSearchParams]);

  const handleFeedbackSelect = (segmentId: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("feedback", segmentId);
    if (segmentIds.includes(segmentId)) {
      nextParams.set("segment", segmentId);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleSegmentSelect = (segmentId: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("segment", segmentId);
    if (feedbackIds.includes(segmentId)) {
      nextParams.set("feedback", segmentId);
    }
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 pb-3">
      <div className="min-h-0 flex-1">
        <div className="grid h-full min-h-0 gap-5 xl:grid-cols-[1.04fr_0.96fr]">
          <div className="min-h-0">
            <ResultsHero />
          </div>
          <div className="grid min-h-0 gap-5 xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-h-0">
              <FeedbackDeck selectedId={activeFeedbackId} onSelect={handleFeedbackSelect} />
            </div>
            <div className="min-h-0">
              <SegmentResultsPanel selectedId={activeSegmentId} onSelect={handleSegmentSelect} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
