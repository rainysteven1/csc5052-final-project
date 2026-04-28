import type { ReactNode } from "react";

type SpotlightHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function SpotlightHeader({ title, subtitle, action }: SpotlightHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="font-medium">{title}</div>
        {subtitle ? <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
      {action}
    </div>
  );
}
