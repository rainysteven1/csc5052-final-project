import { ReplayDemoCatalog } from '@/components/run/ReplayDemoCatalog';
import { ReplayPathField } from '@/components/run/ReplayPathField';
import type { DemoCatalogItem } from '@/types/analysis';

type RunReplayFieldsProps = {
  mode: 'live' | 'replay';
  replayPath: string;
  scenario: string;
  demoCatalog: DemoCatalogItem[];
  isDemoCatalogLoading: boolean;
  showShowcaseGallery: boolean;
  showReplayPathField: boolean;
  onReplayPathChange: (value: string) => void;
  onReplayDemoSelect: (item: DemoCatalogItem) => void;
  onLaunchReplayDemo: (item: DemoCatalogItem) => void;
  onLaunchLiveDemo: (item: DemoCatalogItem) => void;
};

export function RunReplayFields({
  mode,
  replayPath,
  scenario,
  demoCatalog,
  isDemoCatalogLoading,
  showShowcaseGallery,
  showReplayPathField,
  onReplayPathChange,
  onReplayDemoSelect,
  onLaunchReplayDemo,
  onLaunchLiveDemo,
}: RunReplayFieldsProps) {
  return (
    <>
      {showShowcaseGallery ? (
        <ReplayDemoCatalog
          demos={demoCatalog}
          selectedReplayPath={replayPath}
          selectedScenario={scenario}
          mode={mode}
          isLoading={isDemoCatalogLoading}
          onSelect={onReplayDemoSelect}
          onLaunchReplay={onLaunchReplayDemo}
          onLaunchLive={onLaunchLiveDemo}
        />
      ) : null}
      {showReplayPathField && mode === 'replay' ? (
        <ReplayPathField
          replayPath={replayPath}
          onChange={onReplayPathChange}
          recommendedPath={demoCatalog.length ? null : undefined}
        />
      ) : null}
    </>
  );
}
