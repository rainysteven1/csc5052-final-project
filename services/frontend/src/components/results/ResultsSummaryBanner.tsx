import { Cpu } from "lucide-react";

import { SectionEyebrow } from "@/components/shared/SectionEyebrow";
import { Badge } from "@/components/ui/badge";

type ResultsSummaryBannerProps = {
  summary: string;
  provider: string | null;
  model: string | null;
};

export function ResultsSummaryBanner({
  summary,
  provider,
  model,
}: ResultsSummaryBannerProps) {
  return (
    <div className="console-hero-panel bg-gradient-to-br from-stone-950/[0.06] via-white/72 to-amber-200/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionEyebrow>Summary</SectionEyebrow>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{provider || "deterministic fallback"}</Badge>
          <Badge variant="outline">{model || "n/a"}</Badge>
        </div>
      </div>
      <div className="mt-4 text-sm leading-7 text-foreground">{summary}</div>
      <div className="mt-4 console-surface p-4">
        <SectionEyebrow className="flex items-center gap-2">
          <Cpu className="h-4 w-4" />
          <span>Coaching runtime</span>
        </SectionEyebrow>
        <div className="mt-3 text-sm leading-7 text-foreground">
          {model ? `${provider || "llm"} · ${model}` : "deterministic fallback"}
        </div>
      </div>
    </div>
  );
}
