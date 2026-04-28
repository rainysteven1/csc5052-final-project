import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { type PipelineView } from '@/components/pipeline';

const pipelineViews: PipelineView[] = ['overview', 'timeline', 'evidence'];

export function usePipelinePageState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const activeView = pipelineViews.includes(viewParam as PipelineView)
    ? (viewParam as PipelineView)
    : 'overview';

  useEffect(() => {
    if (searchParams.get('view') === activeView) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('view', activeView);
    setSearchParams(nextParams, { replace: true });
  }, [activeView, searchParams, setSearchParams]);

  const handleViewChange = (view: PipelineView) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('view', view);
    setSearchParams(nextParams, { replace: true });
  };

  return {
    activeView,
    handleViewChange,
  };
}
