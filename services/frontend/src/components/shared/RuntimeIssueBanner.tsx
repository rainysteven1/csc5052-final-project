import { AlertTriangle, ShieldAlert, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RuntimeIssue } from "@/types/analysis";

type RuntimeIssueBannerProps = {
  issue: RuntimeIssue;
  onDismiss?: () => void;
  compact?: boolean;
  className?: string;
};

export function RuntimeIssueBanner({ issue, onDismiss, compact = false, className }: RuntimeIssueBannerProps) {
  const destructive = issue.tone === "destructive";
  const Icon = destructive ? ShieldAlert : AlertTriangle;

  return (
    <div
      className={cn(
        "rounded-[24px] border px-4 py-4 text-sm shadow-soft",
        destructive
          ? "border-red-300/70 bg-red-50/92 text-red-900"
          : "border-amber-300/70 bg-amber-50/92 text-amber-900",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-medium">
            <Icon className="h-4 w-4" />
            <span>{destructive ? "Runtime error" : "Runtime warning"}</span>
            {issue.code ? <Badge variant="outline" className="glass-chip-soft normal-case tracking-normal">{issue.code}</Badge> : null}
          </div>
          <div className={cn(compact ? "mt-2 leading-5" : "mt-2 leading-6")}>{issue.message}</div>
          {issue.requestId || issue.traceId ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {issue.requestId ? <Badge variant="outline" className="glass-chip-soft normal-case tracking-normal">request {issue.requestId}</Badge> : null}
              {issue.traceId ? <Badge variant="outline" className="glass-chip-soft normal-case tracking-normal">trace {issue.traceId}</Badge> : null}
            </div>
          ) : null}
        </div>
        {onDismiss ? (
          <Button type="button" size="sm" variant="secondary" className="h-8 rounded-full px-3" onClick={onDismiss}>
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
