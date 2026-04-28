import { Command, FileJson2, Gauge, PlaySquare, Workflow } from 'lucide-react';

import { SidebarBrandCard } from '@/components/navigation/SidebarBrandCard';
import { SidebarNavItem } from '@/components/navigation/SidebarNavItem';
import { type AppTab, appTabs } from '@/types/analysis';

const tabIcons: Record<AppTab, typeof Command> = {
  run: PlaySquare,
  pipeline: Workflow,
  results: Gauge,
  debug: FileJson2,
};

type SidebarNavProps = {
  activeTab: AppTab;
};

export function SidebarNav({ activeTab }: SidebarNavProps) {
  const environmentLabel = 'Local';

  return (
    <aside className='flex h-full min-h-0 flex-col rounded-[28px] glass-panel-strong p-3 shadow-panel backdrop-blur lg:sticky lg:top-0'>
      <SidebarBrandCard environmentLabel={environmentLabel} />

      <div className='flex min-h-0 flex-1 flex-col gap-2.5'>
        {appTabs.map((tab) => {
          const Icon = tabIcons[tab.id];
          const isCurrent = activeTab === tab.id;
          return (
            <SidebarNavItem
              key={tab.id}
              path={tab.path}
              label={tab.label}
              icon={Icon}
              isCurrent={isCurrent}
            />
          );
        })}
      </div>
    </aside>
  );
}
