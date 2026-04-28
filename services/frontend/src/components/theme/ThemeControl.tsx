import { useEffect, useRef, useState } from 'react';

import { ChevronDown, Palette, Settings2 } from 'lucide-react';

import { ThemeSettingsDrawer } from '@/components/theme/ThemeSettingsDrawer';
import { Badge } from '@/components/ui/badge';
import {
  getExplanationLanguageLabel,
  getExplanationLanguageShortLabel,
  getThemePreset,
} from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/store/theme-store';

export function ThemeControl() {
  const presetId = useThemeStore((state) => state.presetId);
  const explanationLanguage = useThemeStore(
    (state) => state.explanationLanguage
  );
  const setExplanationLanguage = useThemeStore(
    (state) => state.setExplanationLanguage
  );
  const activePreset = getThemePreset(presetId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  return (
    <>
      <div ref={containerRef} className='relative'>
        <button
          type='button'
          className={cn(
            'flex h-[54px] min-w-[164px] items-center gap-3 rounded-[20px] glass-panel-strong px-4 py-2.5 text-left transition-all',
            menuOpen
              ? 'border-primary ring-2 ring-primary/15'
              : 'hover:bg-secondary/35'
          )}
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span className='rounded-full bg-primary/10 p-2 text-primary'>
            <Settings2 className='h-4 w-4' />
          </span>
          <span className='min-w-0 flex-1 text-left'>
            <span className='ui-label-xs block text-muted-foreground'>
              Theme
            </span>
            <span className='mt-1 flex items-center justify-between gap-2'>
              <span className='truncate text-sm font-medium text-foreground'>
                {activePreset.label}
              </span>
              <Badge variant='outline' className='shrink-0'>
                {getExplanationLanguageShortLabel(explanationLanguage)}
              </Badge>
            </span>
          </span>
          <span className='shrink-0'>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                menuOpen && 'rotate-180'
              )}
            />
          </span>
        </button>

        {menuOpen ? (
          <div className='absolute right-0 top-full z-[60] mt-3 w-[320px] rounded-[24px] border border-border/80 bg-card p-3 shadow-2xl'>
            <div className='rounded-[20px] border border-border/70 bg-card px-4 py-3'>
              <div className='flex items-center justify-between gap-3'>
                <div>
                  <div className='font-medium text-foreground'>
                    Output language
                  </div>
                  <div className='mt-1 text-sm leading-6 text-muted-foreground'>
                    Switch returned coaching and analysis copy between Chinese
                    and English.
                  </div>
                </div>
                <button
                  type='button'
                  role='switch'
                  aria-checked={explanationLanguage === 'en'}
                  className={cn(
                    'relative inline-flex h-7 w-12 shrink-0 rounded-full border transition-colors',
                    explanationLanguage === 'en'
                      ? 'border-primary bg-primary/90'
                      : 'border-border/80 bg-secondary/70'
                  )}
                  onClick={() =>
                    setExplanationLanguage(
                      explanationLanguage === 'en' ? 'zh' : 'en'
                    )
                  }
                >
                  <span
                    className={cn(
                      'absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                      explanationLanguage === 'en'
                        ? 'translate-x-6'
                        : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
              <div className='mt-3 flex items-center justify-between text-xs text-muted-foreground'>
                <span>Current output</span>
                <Badge variant='outline'>
                  {getExplanationLanguageShortLabel(explanationLanguage)}
                </Badge>
              </div>
              <div className='mt-1 text-xs text-muted-foreground'>
                {getExplanationLanguageLabel(explanationLanguage)}
              </div>
            </div>

            <button
              type='button'
              className='mt-3 flex w-full items-center justify-between rounded-[20px] border border-border/70 bg-card px-4 py-3 text-left transition-all hover:bg-secondary/28'
              onClick={() => {
                setMenuOpen(false);
                setDrawerOpen(true);
              }}
            >
              <div className='flex items-start gap-3'>
                <span className='rounded-full bg-accent/12 p-2 text-accent'>
                  <Palette className='h-4 w-4' />
                </span>
                <span>
                  <span className='block font-medium text-foreground'>
                    Open theme panel
                  </span>
                  <span className='mt-1 block text-sm leading-6 text-muted-foreground'>
                    Change preset and panel contrast.
                  </span>
                </span>
              </div>
              <ChevronDown className='-rotate-90 h-4 w-4 text-muted-foreground' />
            </button>
          </div>
        ) : null}
      </div>

      <ThemeSettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
