import { NavLink } from 'react-router-dom';

import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type SidebarNavItemProps = {
  path: string;
  label: string;
  icon: LucideIcon;
  isCurrent: boolean;
};

export function SidebarNavItem({
  path,
  label,
  icon: Icon,
  isCurrent,
}: SidebarNavItemProps) {
  return (
    <NavLink
      to={path}
      className={({ isActive }) =>
        cn(
          'console-nav-card',
          isActive || isCurrent
            ? 'console-nav-card-active shadow-soft'
            : 'console-nav-card-idle'
        )
      }
    >
      {isCurrent ? (
        <span className='console-nav-marker' aria-hidden='true' />
      ) : null}
      <div className='flex items-start gap-2.5'>
        <div
          className={cn(
            'mt-0.5 rounded-2xl p-1.5',
            isCurrent
              ? 'glass-chip-inverse text-primary-foreground'
              : 'glass-chip-strong text-foreground'
          )}
        >
          <Icon className='h-4 w-4' />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center justify-between gap-3'>
            <div className='text-[13px] font-semibold'>{label}</div>
            <span
              className={cn(
                'ui-label-xs',
                isCurrent
                  ? 'text-primary-foreground/75'
                  : 'text-muted-foreground'
              )}
            >
              {path.replace('/', '')}
            </span>
          </div>
        </div>
      </div>
    </NavLink>
  );
}
