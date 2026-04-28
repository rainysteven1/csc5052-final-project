import { Mic, PlayCircle, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { DemoCatalogItem } from '@/types/analysis';

type ReplayDemoCatalogProps = {
  demos: DemoCatalogItem[];
  selectedReplayPath: string;
  selectedScenario: string;
  mode: 'live' | 'replay';
  isLoading: boolean;
  onSelect: (item: DemoCatalogItem) => void;
  onLaunchReplay: (item: DemoCatalogItem) => void;
  onLaunchLive: (item: DemoCatalogItem) => void;
};

export function ReplayDemoCatalog({
  demos,
  selectedReplayPath,
  selectedScenario,
  mode,
  isLoading,
  onSelect,
  onLaunchReplay,
  onLaunchLive,
}: ReplayDemoCatalogProps) {
  if (isLoading) {
    return (
      <div className='space-y-2'>
        <Label>Showcase gallery</Label>
        <div className='panel-block glass-panel-soft text-sm text-muted-foreground'>
          Loading demo catalog...
        </div>
      </div>
    );
  }

  if (!demos.length) {
    return null;
  }

  return (
    <div className='space-y-2'>
      <Label>Showcase gallery</Label>
      <div className='grid gap-3'>
        {demos.map((demo, index) => {
          const selected =
            mode === 'replay'
              ? demo.replay_path === selectedReplayPath
              : demo.id === selectedScenario;
          return (
            <div
              key={demo.id}
              className={cn(
                'group glass-panel-soft shadow-soft flex min-h-[186px] w-full flex-col gap-4 rounded-[24px] border px-4 py-4 text-left transition-all duration-200',
                'focus-within:-translate-y-0.5 focus-within:border-primary/50 focus-within:shadow-[0_18px_40px_hsl(var(--primary)/0.18)]',
                selected
                  ? 'border-primary/60 bg-primary/[0.08] shadow-[0_18px_40px_hsl(var(--primary)/0.16)] hover:-translate-y-0.5 hover:border-primary/70 hover:shadow-[0_22px_44px_hsl(var(--primary)/0.2)]'
                  : 'border-border/60 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-secondary/70 hover:shadow-[0_18px_40px_rgba(0,0,0,0.08)]'
              )}
            >
              <button
                type='button'
                onClick={() => onSelect(demo)}
                className='flex flex-1 flex-col gap-4 rounded-[18px] text-left focus-visible:outline-none'
              >
                <div className='min-w-0'>
                  <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0'>
                      <div className='text-sm font-semibold text-foreground'>
                        {demo.label}
                      </div>
                      <div className='mt-1 text-xs text-muted-foreground'>
                        {demo.id}
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      {index === 0 ? (
                        <span className='rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary'>
                          Recommended
                        </span>
                      ) : null}
                      <PlayCircle
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0',
                          selected ? 'text-primary' : 'text-muted-foreground'
                        )}
                      />
                    </div>
                  </div>
                </div>
                <div className='grid gap-2 text-xs text-muted-foreground'>
                  <div className='flex items-center gap-2'>
                    <Sparkles className='h-3.5 w-3.5' />
                    <span>Preset scenario for the public showcase flow</span>
                  </div>
                  <div className='console-surface truncate px-3 py-2 font-mono text-[11px] text-foreground'>
                    {demo.replay_path}
                  </div>
                  <div className='truncate'>{demo.audio_filename}</div>
                </div>
              </button>
              <div className='mt-auto grid grid-cols-2 gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => onLaunchReplay(demo)}
                  className='focus-visible:ring-2 focus-visible:ring-primary/40'
                >
                  <PlayCircle className='mr-2 h-3.5 w-3.5' />
                  Open replay
                </Button>
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  onClick={() => onLaunchLive(demo)}
                  className='focus-visible:ring-2 focus-visible:ring-primary/40'
                >
                  <Mic className='mr-2 h-3.5 w-3.5' />
                  Launch live
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
