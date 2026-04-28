import {
  type DebugView,
  DebugViewTabs,
} from '@/components/debug/DebugViewTabs';
import { TraceBadgeRow } from '@/components/debug/TraceBadgeRow';
import { StickyPageBar } from '@/components/shared/StickyPageBar';
import { Badge } from '@/components/ui/badge';
import { useAnalysisStore } from '@/store/analysis-store';

type DebugControlBarProps = {
  activeView: DebugView;
  onChange: (view: DebugView) => void;
};

export function DebugControlBar({
  activeView,
  onChange,
}: DebugControlBarProps) {
  const eventsCount = useAnalysisStore((state) => state.events.length);

  return (
    <StickyPageBar>
      <div className='grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center'>
        <div className='flex flex-wrap items-center gap-2'>
          <DebugViewTabs active={activeView} onChange={onChange} />
          <Badge variant='outline' className='glass-chip-strong'>
            {eventsCount} events
          </Badge>
        </div>
        <TraceBadgeRow compact />
      </div>
    </StickyPageBar>
  );
}
