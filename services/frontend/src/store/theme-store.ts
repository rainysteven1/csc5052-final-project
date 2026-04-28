import { create } from 'zustand';

import {
  applyThemeSettings,
  defaultThemeSettings,
  type ExplanationLanguage,
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
  setExplanationLanguage: (explanationLanguage: ExplanationLanguage) => void;
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
      explanationLanguage: get().explanationLanguage,
    };
    commitThemeSettings(nextSettings);
    set(nextSettings);
  },

  setSurfaceMode: (surfaceMode) => {
    const nextSettings = {
      presetId: get().presetId,
      surfaceMode,
      explanationLanguage: get().explanationLanguage,
    };
    commitThemeSettings(nextSettings);
    set(nextSettings);
  },

  setExplanationLanguage: (explanationLanguage) => {
    const nextSettings = {
      presetId: get().presetId,
      surfaceMode: get().surfaceMode,
      explanationLanguage,
    };
    commitThemeSettings(nextSettings);
    set(nextSettings);
  },
}));
