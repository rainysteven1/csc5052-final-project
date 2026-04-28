import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  RunControlBar,
  RunFormCard,
  RunLensPanel,
  SessionOverviewCard,
} from '@/components/run';
import { isFakeDeployment } from '@/lib/runtime-config';
import { useAnalysisStore } from '@/store/analysis-store';

export function RunPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const loadDemoCatalog = useAnalysisStore((state) => state.loadDemoCatalog);

  useEffect(() => {
    if ([...searchParams.keys()].length === 0) {
      return;
    }

    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!isFakeDeployment) {
      return;
    }
    void loadDemoCatalog();
  }, [loadDemoCatalog]);

  return (
    <div className='flex flex-col gap-5 pb-6'>
      <RunControlBar />
      <RunLensPanel />
      <div className='grid gap-5 xl:grid-cols-[1.04fr_0.96fr] xl:items-start'>
        <div>
          <RunFormCard />
        </div>
        <div>
          <SessionOverviewCard />
        </div>
      </div>
    </div>
  );
}
