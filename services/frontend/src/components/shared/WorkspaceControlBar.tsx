import type { ReactNode } from 'react';

import { StickyPageBar } from '@/components/shared/StickyPageBar';
import { cn } from '@/lib/utils';

type WorkspaceControlBarProps = {
  tabs: ReactNode;
  stats: ReactNode;
  className?: string;
  statsClassName?: string;
};

export function WorkspaceControlBar({
  tabs,
  stats,
  className,
  statsClassName,
}: WorkspaceControlBarProps) {
  return (
    <StickyPageBar className={className}>
      <div className='grid gap-3 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)] xl:items-center'>
        {tabs}
        <div className={cn('grid gap-3', statsClassName)}>{stats}</div>
      </div>
    </StickyPageBar>
  );
}
