import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type StickyPageBarProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

export function StickyPageBar({
  children,
  className,
  innerClassName,
}: StickyPageBarProps) {
  return (
    <div
      className={cn(
        'sticky top-0 z-20 -mx-1 px-1 py-1 backdrop-blur-sm',
        className
      )}
    >
      <div
        className={cn(
          'rounded-[26px] glass-panel-soft p-3 shadow-soft backdrop-blur',
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
