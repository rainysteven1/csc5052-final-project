import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type PipelineSelectableCardProps = {
  children: ReactNode;
  selected?: boolean;
  className?: string;
  onClick?: () => void;
};

export function PipelineSelectableCard({
  children,
  selected = false,
  className,
  onClick,
}: PipelineSelectableCardProps) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'console-selectable hover:shadow-soft',
        selected && 'console-selectable-active',
        className
      )}
    >
      {children}
    </button>
  );
}
