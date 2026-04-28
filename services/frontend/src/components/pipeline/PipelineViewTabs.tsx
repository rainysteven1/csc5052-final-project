import { SectionTabs } from "@/components/shared/SectionTabs";

export type PipelineView = "overview" | "evidence" | "timeline";

const pipelineViews: Array<{ id: PipelineView; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "evidence", label: "Evidence Lens" },
  { id: "timeline", label: "Timeline Lens" },
];

type PipelineViewTabsProps = {
  active: PipelineView;
  onChange: (view: PipelineView) => void;
};

export function PipelineViewTabs({ active, onChange }: PipelineViewTabsProps) {
  return <SectionTabs items={pipelineViews} active={active} onChange={onChange} />;
}
