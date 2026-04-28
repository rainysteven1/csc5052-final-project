export type ThemePresetId =
  | "sandstone"
  | "newsroom"
  | "harbor"
  | "linen"
  | "slate"
  | "ivory";

export type ThemeSurfaceMode = "soft" | "balanced" | "crisp";

export type ThemePreset = {
  id: ThemePresetId;
  label: string;
  description: string;
  swatches: string[];
};

export type ThemeSettings = {
  presetId: ThemePresetId;
  surfaceMode: ThemeSurfaceMode;
};

export const themeStorageKey = "speaksure-theme-settings";

export const themePresets: ThemePreset[] = [
  {
    id: "sandstone",
    label: "Sandstone Review",
    description: "Warm editorial tones with terracotta highlights.",
    swatches: ["#e9774c", "#f4eadf", "#48927f", "#8e5b35"],
  },
  {
    id: "newsroom",
    label: "Newsroom Ledger",
    description: "Calmer paper neutrals with ink-blue structure.",
    swatches: ["#9e4f3b", "#f2eee7", "#3f6174", "#7a746d"],
  },
  {
    id: "harbor",
    label: "Harbor Desk",
    description: "Cool fog, slate, and measured teal contrast.",
    swatches: ["#356e7f", "#eef3f4", "#6c8d8a", "#46596a"],
  },
  {
    id: "linen",
    label: "Linen Brief",
    description: "Muted parchment with graphite and olive accents.",
    swatches: ["#7f5a37", "#f6f1e7", "#66754e", "#59544d"],
  },
  {
    id: "slate",
    label: "Slate Ledger",
    description: "Neutral graphite, cool paper, and deep blue accents.",
    swatches: ["#415266", "#edf1f5", "#62748a", "#c4ccd6"],
  },
  {
    id: "ivory",
    label: "Ivory Briefing",
    description: "Clean ivory surfaces with restrained brass contrast.",
    swatches: ["#8a673f", "#f7f3ea", "#8a8476", "#d6c7ae"],
  },
];

export const surfaceModeOptions: Array<{
  id: ThemeSurfaceMode;
  label: string;
  description: string;
}> = [
  {
    id: "soft",
    label: "Soft",
    description: "Lower contrast, lighter glass.",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Default workspace contrast.",
  },
  {
    id: "crisp",
    label: "Crisp",
    description: "Sharper panels, firmer separation.",
  },
];

export const defaultThemeSettings: ThemeSettings = {
  presetId: "sandstone",
  surfaceMode: "balanced",
};

export function getThemePreset(presetId: ThemePresetId) {
  return (
    themePresets.find((preset) => preset.id === presetId) || themePresets[0]
  );
}

export function isThemePresetId(value: string): value is ThemePresetId {
  return themePresets.some((preset) => preset.id === value);
}

export function isThemeSurfaceMode(value: string): value is ThemeSurfaceMode {
  return surfaceModeOptions.some((option) => option.id === value);
}

export function readThemeSettings(): ThemeSettings {
  if (typeof window === "undefined") {
    return defaultThemeSettings;
  }

  try {
    const raw = window.localStorage.getItem(themeStorageKey);
    if (!raw) {
      return defaultThemeSettings;
    }

    const parsed = JSON.parse(raw) as Partial<ThemeSettings>;
    const presetId = parsed.presetId;
    const surfaceMode = parsed.surfaceMode;

    return {
      presetId: presetId && isThemePresetId(presetId)
        ? presetId
        : defaultThemeSettings.presetId,
      surfaceMode: surfaceMode && isThemeSurfaceMode(surfaceMode)
        ? surfaceMode
        : defaultThemeSettings.surfaceMode,
    };
  } catch {
    return defaultThemeSettings;
  }
}

export function applyThemeSettings(settings: ThemeSettings) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = settings.presetId;
  document.documentElement.dataset.surface = settings.surfaceMode;
}

export function persistThemeSettings(settings: ThemeSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(themeStorageKey, JSON.stringify(settings));
}
