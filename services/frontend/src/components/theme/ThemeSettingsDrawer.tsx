import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { Check, Paintbrush, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  explanationLanguageOptions,
  getExplanationLanguageLabel,
  getExplanationLanguageShortLabel,
  getThemePreset,
  surfaceModeOptions,
  themePresets,
} from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/store/theme-store';

type ThemeSettingsDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export function ThemeSettingsDrawer({
  open,
  onClose,
}: ThemeSettingsDrawerProps) {
  const presetId = useThemeStore((state) => state.presetId);
  const surfaceMode = useThemeStore((state) => state.surfaceMode);
  const explanationLanguage = useThemeStore(
    (state) => state.explanationLanguage
  );
  const setPresetId = useThemeStore((state) => state.setPresetId);
  const setSurfaceMode = useThemeStore((state) => state.setSurfaceMode);
  const setExplanationLanguage = useThemeStore(
    (state) => state.setExplanationLanguage
  );
  const activePreset = getThemePreset(presetId);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const drawer = (
    <div className='fixed inset-0 z-[70] flex justify-end'>
      <button
        type='button'
        className='absolute inset-0 bg-stone-950/28 backdrop-blur-[2px]'
        aria-label='Close theme settings'
        onClick={onClose}
      />
      <aside className='relative h-full w-[460px] max-w-[92vw] overflow-y-auto border-l border-border/70 bg-card px-5 py-5 shadow-2xl'>
        <div className='flex min-h-full flex-col gap-5'>
          <div className='flex items-start justify-between gap-4'>
            <div>
              <div className='ui-label-sm text-muted-foreground'>
                Theme panel
              </div>
              <div className='mt-2 font-display text-2xl font-semibold text-foreground'>
                Tune the workspace
              </div>
              <div className='mt-2 text-sm leading-6 text-muted-foreground'>
                Switch preset, surface contrast, and returned explanation
                language.
              </div>
            </div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='h-9 w-9 rounded-full p-0'
              onClick={onClose}
            >
              <X className='h-4 w-4' />
            </Button>
          </div>

          <div className='rounded-[24px] border border-border/70 bg-background p-4'>
            <div className='flex items-center justify-between gap-3'>
              <div>
                <div className='ui-label-sm text-muted-foreground'>
                  Active preset
                </div>
                <div className='mt-2 font-medium text-foreground'>
                  {activePreset.label}
                </div>
              </div>
              <div className='flex flex-wrap items-center justify-end gap-2'>
                <Badge variant='accent'>{surfaceMode}</Badge>
                <Badge variant='outline'>
                  {getExplanationLanguageShortLabel(explanationLanguage)} output
                </Badge>
              </div>
            </div>
            <div className='mt-3 text-sm leading-6 text-muted-foreground'>
              {activePreset.description}
            </div>
            <div className='mt-4 flex flex-wrap gap-2'>
              {activePreset.swatches.map((swatch) => (
                <span
                  key={`${activePreset.id}-${swatch}`}
                  className='h-8 w-8 rounded-full border border-white/70 shadow-sm'
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </div>
          </div>

          <section className='space-y-3'>
            <div className='ui-label-sm text-muted-foreground'>Presets</div>
            <div className='grid gap-3'>
              {themePresets.map((preset) => {
                const active = preset.id === presetId;
                return (
                  <button
                    key={preset.id}
                    type='button'
                    onClick={() => setPresetId(preset.id)}
                    className={cn(
                      'rounded-[22px] border p-4 text-left transition-all',
                      active
                        ? 'border-primary bg-primary/8 ring-2 ring-primary/15'
                        : 'border-border/70 bg-card hover:bg-secondary/24'
                    )}
                  >
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <div className='font-medium text-foreground'>
                          {preset.label}
                        </div>
                        <div className='mt-2 text-sm leading-6 text-muted-foreground'>
                          {preset.description}
                        </div>
                      </div>
                      {active ? (
                        <span className='rounded-full bg-primary/12 p-2 text-primary'>
                          <Check className='h-4 w-4' />
                        </span>
                      ) : null}
                    </div>
                    <div className='mt-4 flex flex-wrap gap-2'>
                      {preset.swatches.map((swatch) => (
                        <span
                          key={`${preset.id}-${swatch}`}
                          className='h-7 w-7 rounded-full border border-white/70'
                          style={{ backgroundColor: swatch }}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className='space-y-3'>
            <div className='ui-label-sm text-muted-foreground'>
              Output language
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
              {explanationLanguageOptions.map((option) => {
                const active = option.id === explanationLanguage;
                return (
                  <button
                    key={option.id}
                    type='button'
                    onClick={() => setExplanationLanguage(option.id)}
                    className={cn(
                      'rounded-[20px] border px-4 py-3 text-left transition-all',
                      active
                        ? 'border-primary bg-primary/8 ring-2 ring-primary/15'
                        : 'border-border/70 bg-card hover:bg-secondary/24'
                    )}
                  >
                    <div className='flex items-center justify-between gap-3'>
                      <div className='font-medium text-foreground'>
                        {option.label}
                      </div>
                      {active ? (
                        <Badge variant='outline'>
                          {getExplanationLanguageShortLabel(option.id)}
                        </Badge>
                      ) : null}
                    </div>
                    <div className='mt-2 text-sm leading-6 text-muted-foreground'>
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className='text-xs text-muted-foreground'>
              Current output: {getExplanationLanguageLabel(explanationLanguage)}
            </div>
          </section>

          <section className='space-y-3'>
            <div className='ui-label-sm text-muted-foreground'>Surfaces</div>
            <div className='grid gap-3'>
              {surfaceModeOptions.map((option) => {
                const active = option.id === surfaceMode;
                return (
                  <button
                    key={option.id}
                    type='button'
                    onClick={() => setSurfaceMode(option.id)}
                    className={cn(
                      'rounded-[20px] border px-4 py-3 text-left transition-all',
                      active
                        ? 'border-accent bg-accent/10'
                        : 'border-border/70 bg-card hover:bg-secondary/24'
                    )}
                  >
                    <div className='flex items-center justify-between gap-3'>
                      <div className='font-medium text-foreground'>
                        {option.label}
                      </div>
                      {active ? (
                        <Paintbrush className='h-4 w-4 text-accent' />
                      ) : null}
                    </div>
                    <div className='mt-2 text-sm leading-6 text-muted-foreground'>
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );

  if (typeof document === 'undefined') {
    return drawer;
  }

  return createPortal(drawer, document.body);
}
