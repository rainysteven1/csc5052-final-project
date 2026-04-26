import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { Activity, Command, RadioTower, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { SidebarNav } from "@/components/navigation/SidebarNav";
import { prettifyNode, statusTone } from "@/lib/analysis-helpers";
import { pathToTab } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useAnalysisStore } from "@/store/analysis-store";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const mode = useAnalysisStore((state) => state.mode);
  const job = useAnalysisStore((state) => state.job);
  const activeNode = useAnalysisStore((state) => state.activeNode);
  const eventsCount = useAnalysisStore((state) => state.events.length);
  const location = useLocation();
  const activeTab = pathToTab(location.pathname);

  const activeBadgeLabel = mode === "live" ? "Live SSE" : "Replay";

  return (
    <main className="min-h-screen px-4 py-4 md:px-6 lg:h-screen lg:overflow-hidden lg:px-7 lg:py-5">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1720px] grid-rows-[76px_minmax(0,1fr)] gap-3 lg:h-full lg:min-h-0">
        <header className="rounded-[28px] border border-white/65 bg-hero-glow px-5 py-3 shadow-panel backdrop-blur md:px-6">
          <div className="flex h-full items-center justify-between gap-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-[20px] border border-white/65 bg-white/80 p-2.5 shadow-soft">
                <Command className="h-4.5 w-4.5 text-foreground" />
              </div>
              <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">SpeakSure++</div>
              <div className="font-display text-lg font-semibold tracking-tight text-foreground">
                  Admin Review Workspace
              </div>
            </div>
          </div>

            <div className="grid min-w-[500px] grid-cols-3 gap-2.5">
              <ShellStat
                label="Mode"
                value={activeBadgeLabel}
                icon={mode === "live" ? <RadioTower className="h-4 w-4" /> : <RefreshCcw className="h-4 w-4" />}
              />
              <ShellStat label="Current node" value={prettifyNode(job?.current_node || activeNode)} icon={<Activity className="h-4 w-4" />} />
              <div className="rounded-[20px] border border-white/65 bg-white/78 p-2.5">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Status</div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <Badge variant={statusTone(job?.status) as "default"}>{job?.status || "idle"}</Badge>
                  <span className="text-sm text-muted-foreground">{eventsCount} events</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[252px_minmax(0,1fr)]">
          <SidebarNav activeTab={activeTab} />
          <section className={cn("min-h-0 flex-1 pb-3 lg:overflow-hidden")}>{children}</section>
        </div>
      </div>
    </main>
  );
}

type ShellStatProps = {
  label: string;
  value: string;
  icon: ReactNode;
};

function ShellStat({ label, value, icon }: ShellStatProps) {
  return (
    <div className="rounded-[20px] border border-white/65 bg-white/78 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="content-scroll mt-1 max-h-14 pr-1 text-[13px] font-medium capitalize text-foreground">{value}</div>
    </div>
  );
}
