import { Badge } from "@/components/ui/badge";
import { statusTone } from "@/lib/analysis-helpers";

type StatusBadgeProps = {
  status?: string | null;
  label?: string | null;
  className?: string;
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const resolvedStatus = status || "idle";
  return (
    <Badge variant={statusTone(resolvedStatus) as "default"} className={className}>
      {label || resolvedStatus}
    </Badge>
  );
}
