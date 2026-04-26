import { cn } from "@/lib/utils";
import { scoreToPercent } from "@/lib/analysis-helpers";

type MetricBarProps = {
  label: string;
  value: unknown;
  tone?: string;
};

export function MetricBar({ label, value, tone = "from-primary to-accent" }: MetricBarProps) {
  const percent = scoreToPercent(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="uppercase tracking-[0.18em]">{label}</span>
        <span>{typeof value === "number" ? value.toFixed(2) : String(value ?? "--")}</span>
      </div>
      <div className="h-2 rounded-full bg-secondary">
        <div className={cn("h-2 rounded-full bg-gradient-to-r", tone)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
