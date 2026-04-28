import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { ShellHeader } from "@/components/layout/ShellHeader";
import { SidebarNav } from "@/components/navigation";
import { RuntimeIssueToast } from "@/components/shared/RuntimeIssueToast";
import { pathToTab } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useAnalysisStore } from "@/store/analysis-store";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const error = useAnalysisStore((state) => state.error);
  const dismissError = useAnalysisStore((state) => state.dismissError);
  const location = useLocation();
  const activeTab = pathToTab(location.pathname);

  return (
    <main className="min-h-screen px-4 py-4 md:px-6 lg:h-screen lg:overflow-hidden lg:px-7 lg:py-4">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1720px] grid-rows-[68px_minmax(0,1fr)] gap-3 lg:h-full lg:min-h-0">
        <ShellHeader />

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[252px_minmax(0,1fr)]">
          <SidebarNav activeTab={activeTab} />
          <section className={cn("min-h-0 flex-1 pb-6 lg:overflow-y-auto lg:pr-2")}>{children}</section>
        </div>
      </div>
      <RuntimeIssueToast issue={error} onDismiss={dismissError} />
    </main>
  );
}
