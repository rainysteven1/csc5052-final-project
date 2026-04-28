import { SectionTabs } from '@/components/shared/SectionTabs';

export type ResultsView = 'summary' | 'feedback' | 'segments';

const resultsViews: Array<{ id: ResultsView; label: string }> = [
  { id: 'summary', label: 'Summary Lens' },
  { id: 'feedback', label: 'Feedback Lens' },
  { id: 'segments', label: 'Segment Lens' },
];

type ResultsViewTabsProps = {
  active: ResultsView;
  onChange: (view: ResultsView) => void;
};

export function ResultsViewTabs({ active, onChange }: ResultsViewTabsProps) {
  return (
    <SectionTabs items={resultsViews} active={active} onChange={onChange} />
  );
}
