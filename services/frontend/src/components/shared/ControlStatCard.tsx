import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ControlStatCardProps = {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  className?: string;
};

export function ControlStatCard({ label, value, meta, className }: ControlStatCardProps) {
  return (
    <div className={cn("console-stat-surface", className)}>
      <div className="ui-label-xs text-muted-foreground">{label}</div>
      <div className="mt-2 break-words text-sm font-medium text-foreground">{value}</div>
      {meta ? <div className="mt-2 text-xs text-muted-foreground">{meta}</div> : null}
    </div>
  );
}
