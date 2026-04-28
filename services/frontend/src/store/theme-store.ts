import { create } from 'zustand';

import {
  applyThemeSettings,
  defaultThemeSettings,
  persistThemeSettings,
  readThemeSettings,
  type ThemePresetId,
  type ThemeSettings,
  type ThemeSurfaceMode,
} from '@/lib/theme';

const initialThemeSettings =
  typeof window === 'undefined' ? defaultThemeSettings : readThemeSettings();

applyThemeSettings(initialThemeSettings);

type ThemeStore = ThemeSettings & {
  setPresetId: (presetId: ThemePresetId) => void;
  setSurfaceMode: (surfaceMode: ThemeSurfaceMode) => void;
};

function commitThemeSettings(settings: ThemeSettings) {
  applyThemeSettings(settings);
  persistThemeSettings(settings);
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  ...initialThemeSettings,

  setPresetId: (presetId) => {
    const nextSettings = {
      presetId,
      surfaceMode: get().surfaceMode,
    };
    commitThemeSettings(nextSettings);
    set(nextSettings);
  },

  setSurfaceMode: (surfaceMode) => {
    const nextSettings = {
      presetId: get().presetId,
      surfaceMode,
    };
    commitThemeSettings(nextSettings);
    set(nextSettings);
  },
}));
