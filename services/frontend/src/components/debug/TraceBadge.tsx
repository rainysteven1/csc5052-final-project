import { useState } from "react";
import { CheckCheck, Copy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type TraceBadgeProps = {
  label: string;
  value: string | null;
  compact?: boolean;
};

export function TraceBadge({ label, value, compact = false }: TraceBadgeProps) {
  const [copied, setCopied] = useState(false);
  const disabled = !value;

  async function handleCopy() {
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  if (compact) {
    return (
      <div className="console-pill-soft flex min-w-[220px] items-center justify-between gap-3 px-3 py-2">
        <div className="min-w-0">
          <div className="ui-label-xs text-stone-500">{label}</div>
          <div className="truncate text-xs font-medium text-stone-900">{value || "n/a"}</div>
        </div>
        <TraceCopyButton copied={copied} disabled={disabled} onClick={handleCopy} />
      </div>
    );
  }

  return (
    <div className="rounded-[18px] glass-panel-strong px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="ui-label-xs text-stone-500">{label}</div>
          <div className="mt-2 truncate text-sm font-medium text-stone-900">{value || "n/a"}</div>
        </div>
        <TraceCopyButton copied={copied} disabled={disabled} onClick={handleCopy} />
      </div>
      <div className="mt-2">
        <Badge variant="outline" className="ui-label-xs glass-chip-soft text-stone-700">
          {label}
        </Badge>
      </div>
    </div>
  );
}

type TraceCopyButtonProps = {
  copied: boolean;
  disabled: boolean;
  onClick: () => void;
};

function TraceCopyButton({
  copied,
  disabled,
  onClick,
}: TraceCopyButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="h-8 shrink-0 gap-2 rounded-full px-3"
      onClick={onClick}
      disabled={disabled}
    >
      {copied ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </Button>
  );
}
