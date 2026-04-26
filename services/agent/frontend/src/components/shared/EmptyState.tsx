import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[180px] flex-col items-center justify-center rounded-[24px] border border-dashed border-border/80 bg-white/55 px-6 text-center",
        className,
      )}
    >
      {icon ? <div className="mb-4 rounded-full border border-border/70 bg-background/80 p-3 text-muted-foreground">{icon}</div> : null}
      <div className="font-medium text-foreground">{title}</div>
      {description ? <div className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</div> : null}
    </div>
  );
}
