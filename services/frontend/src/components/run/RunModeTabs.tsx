import { SectionTabs } from "@/components/shared/SectionTabs";
import type { AppMode } from "@/types/analysis";

const runModeItems: Array<{ id: AppMode; label: string }> = [
  { id: "live", label: "Live Run" },
  { id: "replay", label: "Replay Load" },
];

type RunModeTabsProps = {
  active: AppMode;
  onChange: (mode: AppMode) => void;
  className?: string;
};

export function RunModeTabs({ active, onChange, className }: RunModeTabsProps) {
  return <SectionTabs items={runModeItems} active={active} onChange={onChange} className={className} />;
}
