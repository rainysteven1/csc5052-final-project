import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { ResultsMetricsGrid } from "@/components/results/ResultsMetricsGrid";
import { ResultsSignalColumn } from "@/components/results/ResultsSignalColumn";
import { ResultsSummaryBanner } from "@/components/results/ResultsSummaryBanner";
import { ResultsTranscriptColumn } from "@/components/results/ResultsTranscriptColumn";
import { buildResultSummary } from "@/lib/analysis-helpers";
import { useAnalysisStore } from "@/store/analysis-store";

export function ResultsHero() {
  const finalState = useAnalysisStore((state) => state.finalState);
  const job = useAnalysisStore((state) => state.job);
  const summary = buildResultSummary(finalState, job);

  return (
    <PageSectionCard eyebrow="Report" title="Final output digest" contentClassName="flex flex-col gap-4">
      <ResultsMetricsGrid summary={summary} />

      <ResultsSummaryBanner
        summary={summary.summary}
        provider={summary.coachingProvider}
        model={summary.coachingModel}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr] xl:items-start">
        <ResultsSignalColumn summary={summary} />
        <ResultsTranscriptColumn transcript={summary.transcript} />
      </div>
    </PageSectionCard>
  );
}
