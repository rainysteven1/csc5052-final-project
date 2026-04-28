import { type AppTab, appTabs } from '@/types/analysis';

const tabByPath = new Map(appTabs.map((tab) => [tab.path, tab.id]));
const pathByTab = new Map(appTabs.map((tab) => [tab.id, tab.path]));

export function pathToTab(pathname: string): AppTab {
  if (tabByPath.has(pathname)) {
    return tabByPath.get(pathname) as AppTab;
  }
  return 'run';
}

export function tabToPath(tab: AppTab): string {
  return pathByTab.get(tab) || '/run';
}
