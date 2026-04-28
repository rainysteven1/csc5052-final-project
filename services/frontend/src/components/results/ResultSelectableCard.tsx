import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ResultSelectableCardProps = {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
};

export function ResultSelectableCard({
  selected = false,
  onClick,
  children,
  className,
}: ResultSelectableCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "console-selectable relative overflow-hidden px-4 py-3 text-left transition-all hover:shadow-soft",
        selected && "console-selectable-active",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-border/70 transition-colors",
          selected && "bg-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.18)]",
        )}
      />
      <div className="relative z-[1]">{children}</div>
    </button>
  );
}
