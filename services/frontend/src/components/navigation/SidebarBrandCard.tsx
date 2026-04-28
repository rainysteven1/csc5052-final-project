import { MonitorCog } from "lucide-react";

import { Badge } from "@/components/ui/badge";

type SidebarBrandCardProps = {
  environmentLabel: string;
};

export function SidebarBrandCard({ environmentLabel }: SidebarBrandCardProps) {
  return (
    <div className="brand-gradient-panel mb-3 rounded-[24px] glass-panel-soft p-4 text-white shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-[18px] glass-chip-inverse p-2.5">
          <MonitorCog className="h-4.5 w-4.5" />
        </div>
        <Badge variant="outline" className="glass-badge-inverse text-white">
          {environmentLabel}
        </Badge>
      </div>
      <div className="mt-4">
        <div className="ui-label-xs text-white/65">SpeakSure++</div>
        <div className="mt-1 font-display text-lg font-semibold tracking-tight">Review Console</div>
      </div>
    </div>
  );
}
