import { SectionTabs } from '@/components/shared/SectionTabs';

export type DebugView = 'metadata' | 'state' | 'event';

const debugViews: Array<{ id: DebugView; label: string }> = [
  { id: 'metadata', label: 'Metadata' },
  { id: 'state', label: 'State JSON' },
  { id: 'event', label: 'Event JSON' },
];

type DebugViewTabsProps = {
  active: DebugView;
  onChange: (view: DebugView) => void;
};

export function DebugViewTabs({ active, onChange }: DebugViewTabsProps) {
  return <SectionTabs items={debugViews} active={active} onChange={onChange} />;
}
