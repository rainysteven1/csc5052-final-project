import { useState } from 'react';

import type { DebugView } from '@/components/debug/DebugViewTabs';

export function useDebugPageState() {
  const [activeView, setActiveView] = useState<DebugView>('metadata');

  return {
    activeView,
    handleViewChange: setActiveView,
  };
}
