import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type WorkspaceColumnsProps = {
  left: ReactNode;
  right?: ReactNode | null;
  className?: string;
  columnsClassName?: string;
};

export function WorkspaceColumns({
  left,
  right,
  className,
  columnsClassName,
}: WorkspaceColumnsProps) {
  return (
    <div className={cn('grid gap-5', className)}>
      <div className={cn('grid gap-5 xl:items-start', columnsClassName)}>
        <div className='min-w-0'>{left}</div>
        {right ? <div className='min-w-0'>{right}</div> : null}
      </div>
    </div>
  );
}
