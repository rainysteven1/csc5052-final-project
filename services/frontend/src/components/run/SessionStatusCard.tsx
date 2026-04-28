import type { AnalysisJob } from "@/types/analysis";

import { SurfaceLabelSection } from "@/components/shared/SurfaceSection";
import { StatusBadge } from "@/components/shared/StatusBadge";

type SessionStatusCardProps = {
  job: AnalysisJob;
};

export function SessionStatusCard({ job }: SessionStatusCardProps) {
  return (
    <SurfaceLabelSection
      label="Session status"
      subtle
      paddingClassName="p-5"
      className="text-sm"
      action={<StatusBadge status={job.status} />}
    >
      <div className="mt-2 break-all font-medium text-foreground">{job.analysis_id}</div>
      <div className="mt-4 grid gap-2 text-muted-foreground">
        <div>Scenario: {job.scenario}</div>
        <div className="break-all">Audio: {job.audio_filename}</div>
        <div>
          Steps: {job.completed_steps} / {job.total_steps}
        </div>
      </div>
    </SurfaceLabelSection>
  );
}
