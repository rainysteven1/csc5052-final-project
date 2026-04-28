import { useEffect } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { useReplayPlayback } from '@/hooks/useReplayPlayback';
import { DebugPage } from '@/pages/DebugPage';
import { PipelinePage } from '@/pages/PipelinePage';
import { ResultsPage } from '@/pages/ResultsPage';
import { RunPage } from '@/pages/RunPage';
import { useAnalysisStore } from '@/store/analysis-store';

function App() {
  const cleanup = useAnalysisStore((state) => state.cleanup);
  const navigationTarget = useAnalysisStore((state) => state.navigationTarget);
  const consumeNavigationTarget = useAnalysisStore(
    (state) => state.consumeNavigationTarget
  );
  const location = useLocation();
  const navigate = useNavigate();

  useReplayPlayback();

  useEffect(() => cleanup, [cleanup]);

  useEffect(() => {
    if (!navigationTarget) {
      return;
    }

    const currentLocation = `${location.pathname}${location.search}`;
    if (currentLocation !== navigationTarget) {
      navigate(navigationTarget);
    }
    consumeNavigationTarget();
  }, [
    consumeNavigationTarget,
    location.pathname,
    location.search,
    navigate,
    navigationTarget,
  ]);

  return (
    <AppShell>
      <Routes>
        <Route path='/' element={<Navigate to='/run' replace />} />
        <Route path='/run' element={<RunPage />} />
        <Route path='/pipeline' element={<PipelinePage />} />
        <Route path='/results' element={<ResultsPage />} />
        <Route path='/debug' element={<DebugPage />} />
        <Route path='*' element={<Navigate to='/run' replace />} />
      </Routes>
    </AppShell>
  );
}

export default App;
