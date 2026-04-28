import { PageSectionCard } from "@/components/shared/PageSectionCard";
import { StatCardGrid, type StatCardItem } from "@/components/shared/StatCardGrid";
import { defaultReplayPath } from "@/types/analysis";
import { useAnalysisStore } from "@/store/analysis-store";

export function RunLensPanel() {
  const mode = useAnalysisStore((state) => state.mode);
  const scenario = useAnalysisStore((state) => state.scenario);
  const audioFile = useAnalysisStore((state) => state.audioFile);
  const replayPath = useAnalysisStore((state) => state.replayPath);
  const transcriptOverride = useAnalysisStore((state) => state.transcriptOverride);
  const job = useAnalysisStore((state) => state.job);

  const sourceValue =
    mode === "live"
      ? audioFile?.name || "no audio selected"
      : replayPath.trim() || defaultReplayPath;

  const transcriptMeta = transcriptOverride.trim()
    ? `${transcriptOverride.trim().split(/\s+/).length} words`
    : "ASR will remain enabled";

  const items: StatCardItem[] = [
    {
      label: "Mode",
      value: mode === "live" ? "Live analysis" : "Replay load",
      meta: job?.status || "idle",
    },
    {
      label: "Scenario",
      value: scenario,
      meta: mode === "live" ? "applies to live coaching" : "used for replay inspection",
    },
    {
      label: "Source",
      value: sourceValue,
      meta: mode === "live" ? (audioFile ? "local upload ready" : "waiting for upload") : "JSON replay path",
    },
    {
      label: "Transcript override",
      value: transcriptOverride.trim() ? "enabled" : "disabled",
      meta: transcriptMeta,
    },
  ];

  return (
    <PageSectionCard eyebrow="Workspace" title="Run lens">
      <StatCardGrid items={items} columnsClassName="grid gap-3 lg:grid-cols-4" />
    </PageSectionCard>
  );
}
