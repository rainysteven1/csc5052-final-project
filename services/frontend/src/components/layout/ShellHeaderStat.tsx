import type { ReactNode } from "react";

type ShellHeaderStatProps = {
  label: string;
  value: string;
  icon: ReactNode;
};

export function ShellHeaderStat({
  label,
  value,
  icon,
}: ShellHeaderStatProps) {
  return (
    <div className="flex h-[54px] items-center gap-3 rounded-[20px] glass-panel-strong px-4 py-2.5">
      <span className="shrink-0 rounded-full bg-primary/10 p-2 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="ui-label-xs block text-muted-foreground">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-sm font-medium capitalize leading-5 text-foreground">
          {value}
        </span>
      </span>
    </div>
  );
}
