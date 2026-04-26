import {
  Command,
  FileJson2,
  Gauge,
  PlaySquare,
  Workflow,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { appTabs, type AppTab } from "@/types/analysis";
import { cn } from "@/lib/utils";

const tabIcons: Record<AppTab, typeof Command> = {
  run: PlaySquare,
  pipeline: Workflow,
  results: Gauge,
  debug: FileJson2,
};

type SidebarNavProps = {
  activeTab: AppTab;
};

export function SidebarNav({ activeTab }: SidebarNavProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col rounded-[28px] border border-white/70 bg-white/80 p-3 shadow-panel backdrop-blur">
      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        {appTabs.map((tab) => {
          const Icon = tabIcons[tab.id];
          return (
            <NavLink
              key={tab.id}
              to={tab.path}
              className={({ isActive }) =>
                cn(
                  "rounded-[22px] border px-3.5 py-3 transition-all",
                  isActive || activeTab === tab.id
                    ? "border-primary bg-primary text-primary-foreground shadow-soft"
                    : "border-border/70 bg-background/70 text-foreground hover:bg-secondary/70",
                )
              }
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={cn(
                    "mt-0.5 rounded-2xl p-1.5",
                    activeTab === tab.id ? "bg-white/15 text-primary-foreground" : "bg-white/70 text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[13px] font-semibold">{tab.label}</div>
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-[0.14em]",
                        activeTab === tab.id ? "text-primary-foreground/75" : "text-muted-foreground",
                      )}
                    >
                      {tab.path.replace("/", "")}
                    </span>
                  </div>
                </div>
              </div>
            </NavLink>
          );
        })}
      </div>
    </aside>
  );
}
