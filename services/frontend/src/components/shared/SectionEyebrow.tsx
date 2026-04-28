import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SectionEyebrowProps = {
  children: ReactNode;
  className?: string;
};

export function SectionEyebrow({
  children,
  className,
}: SectionEyebrowProps) {
  return (
    <div className={cn("ui-label-sm text-muted-foreground", className)}>
      {children}
    </div>
  );
}
