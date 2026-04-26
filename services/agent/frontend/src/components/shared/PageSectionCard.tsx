import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PageSectionCardProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function PageSectionCard({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: PageSectionCardProps) {
  return (
    <Card className={cn("flex min-h-0 flex-col", className)}>
      <CardHeader className="shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            {eyebrow ? <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</div> : null}
            <CardTitle>{title}</CardTitle>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className={cn("min-h-0 flex-1 overflow-hidden", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
