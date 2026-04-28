import { Activity, Command, RadioTower, RefreshCcw } from "lucide-react";

import { ShellHeaderStat } from "@/components/layout/ShellHeaderStat";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ThemeControl } from "@/components/theme";
import { prettifyNode } from "@/lib/analysis-helpers";
import { useAnalysisStore } from "@/store/analysis-store";

export function ShellHeader() {
  const mode = useAnalysisStore((state) => state.mode);
  const job = useAnalysisStore((state) => state.job);
  const activeNode = useAnalysisStore((state) => state.activeNode);
  const eventsCount = useAnalysisStore((state) => state.events.length);

  const activeBadgeLabel = mode === "live" ? "Live SSE" : "Replay";

  return (
    <header className="relative z-40 overflow-visible rounded-[26px] glass-panel-strong bg-hero-glow px-5 py-2.5 shadow-panel backdrop-blur md:px-6">
      <div className="flex h-full items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-[18px] glass-panel-strong p-2 shadow-soft">
            <Command className="h-4.5 w-4.5 text-foreground" />
          </div>
          <div className="min-w-0">
            <div className="ui-label-xs text-muted-foreground/90">
              SpeakSure++
            </div>
            <div className="font-display text-base font-semibold tracking-tight text-foreground">
              Admin Review Workspace
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="grid min-w-[480px] grid-cols-3 gap-2">
            <ShellHeaderStat
              label="Mode"
              value={activeBadgeLabel}
              icon={
                mode === "live" ? (
                  <RadioTower className="h-4 w-4" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )
              }
            />
            <ShellHeaderStat
              label="Current node"
              value={prettifyNode(job?.current_node || activeNode)}
              icon={<Activity className="h-4 w-4" />}
            />
            <div className="flex h-[54px] flex-col justify-center rounded-[20px] glass-panel-strong px-4 py-3">
              <div className="ui-label-xs text-muted-foreground">Status</div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <StatusBadge status={job?.status} />
                <span className="text-sm text-muted-foreground">
                  {eventsCount} events
                </span>
              </div>
            </div>
          </div>
          <ThemeControl />
        </div>
      </div>
    </header>
  );
}
