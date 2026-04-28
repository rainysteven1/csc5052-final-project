import { RuntimeIssueBanner } from "@/components/shared/RuntimeIssueBanner";
import type { RuntimeIssue } from "@/types/analysis";

type RuntimeIssueToastProps = {
  issue: RuntimeIssue | null;
  onDismiss: () => void;
};

export function RuntimeIssueToast({ issue, onDismiss }: RuntimeIssueToastProps) {
  if (!issue) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 max-w-[440px]">
      <div className="pointer-events-auto">
        <RuntimeIssueBanner issue={issue} onDismiss={onDismiss} compact className="backdrop-blur" />
      </div>
    </div>
  );
}
