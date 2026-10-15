import { create } from "zustand";
import { persist } from "zustand/middleware";
import { clampAppZoom } from "@/lib/appZoom";
import { migrateLocalStorageKey } from "@/lib/storageMigration";
import type {
  AudioPrefs,
  BlockConfig,
  CategoryConfig,
  ColorThemeFile,
  CustomSound,
  ManualWeatherCoords,
} from "@/types";
import {
  DEFAULT_TASK_CLICK_SOUND_ID,
  DEFAULT_TASK_CREATE_SOUND_ID,
  DEFAULT_TASK_UNCHECK_SOUND_ID,
  customSoundId,
  evictTaskClickSoundFromCache,
  normalizeAudioPrefs,
} from "@/lib/taskClickSounds";
import {
  applyTheme,
  normalizeThemePreference,
  type ThemePreference,
} from "@/lib/appTheme";
import {
  DEFAULT_COLOR_THEME_ID,
  applyColorTheme,
  findColorTheme,
  normalizeCustomColorThemes,
} from "@/lib/colorThemes";

/**
 * How much the UI animates. "full" still follows the macOS Reduce Motion
 * setting; "minimal" keeps fades but drops movement; "none" makes every
 * change instant.
 */
type MotionLevel = "none" | "minimal" | "full";

const MOTION_LEVELS: readonly MotionLevel[] = ["none", "minimal", "full"];

function normalizeMotionLevel(level: unknown): MotionLevel {
  return MOTION_LEVELS.includes(level as MotionLevel)
    ? (level as MotionLevel)
    : "full";
}

type SidebarMode = "tasks" | "social" | "apps";

type SidebarState = {
  open: boolean;
  width: number;
  mode: SidebarMode;
  taskOrder: string[];
  socialOrder: string[];
  appOrder: string[];
  /** User chose the icon-only rail even though the window has room to expand. */
  compact: boolean;
};

type RightPanelState = {
  open: boolean;
  width: number;
};

type SettingsState = {
  theme: ThemePreference;
  /** Id of the active color theme (built-in or custom). */
  colorTheme: string;
  /**
   * Valid themes from the user's themes folder, cached so the active one can
   * be painted before the folder is read. See userThemesStore.
   */
  customColorThemes: ColorThemeFile[];
  dayTransitionEnabled: boolean;
  motionLevel: MotionLevel;
  zoomLevel: number;
  sidebar: SidebarState;
  rightPanel: RightPanelState;
  pinnedToolkitPanels: string[];
  weatherCoords: ManualWeatherCoords | null;
  audioPrefs: AudioPrefs;
  customSounds: CustomSound[];
  blockConfigs: BlockConfig[];
  categoryConfigs: CategoryConfig[];

  setTheme: (theme: ThemePreference) => void;
  setColorTheme: (id: string) => void;
  /** Replaces the cache after a folder scan. */
  setCustomColorThemes: (themes: ColorThemeFile[]) => void;
  /** Adds or replaces (by id) an imported theme and makes it active. */
  addCustomColorTheme: (theme: ColorThemeFile) => void;
  removeCustomColorTheme: (id: string) => void;
  setDayTransitionEnabled: (enabled: boolean) => void;
  setMotionLevel: (level: MotionLevel) => void;
  setZoomLevel: (level: number) => void;
  setSidebar: (state: Partial<SidebarState>) => void;
  setRightPanel: (state: Partial<RightPanelState>) => void;
  setPinnedToolkitPanels: (panelIds: string[]) => void;
  setWeatherCoords: (coords: ManualWeatherCoords | null) => void;
  setAudioPrefs: (
    prefs: AudioPrefs | ((prev: AudioPrefs) => AudioPrefs),
  ) => void;
  addCustomSound: (sound: CustomSound) => void;
  /**
   * Replaces the whole sound list (the sounds folder is the source of truth).
   * `remap` rewrites selected sound ids, e.g. after migrating a sound to a file.
   */
  setCustomSounds: (sounds: CustomSound[], remap?: Record<string, string>) => void;
  removeCustomSound: (id: string) => void;
  setBlockConfigs: (configs: BlockConfig[]) => void;
  setCategoryConfigs: (configs: CategoryConfig[]) => void;
};

const DEFAULT_SIDEBAR: SidebarState = {
  open: true,
  width: 220,
  mode: "tasks",
  taskOrder: [],
  socialOrder: [],
  appOrder: [],
  compact: false,
};

const DEFAULT_RIGHT_PANEL: RightPanelState = {
  open: false,
  width: 320,
};

const DEFAULT_AUDIO_PREFS: AudioPrefs = {
  soundEnabled: true,
  volume: 80,
  taskClickSoundId: DEFAULT_TASK_CLICK_SOUND_ID,
  taskUncheckSoundId: DEFAULT_TASK_UNCHECK_SOUND_ID,
  taskCreateSoundId: DEFAULT_TASK_CREATE_SOUND_ID,
};

function clampAudioVolume(volume: number): number {
  if (!Number.isFinite(volume)) return DEFAULT_AUDIO_PREFS.volume;
  return Math.min(100, Math.max(0, Math.round(volume)));
}

function normalizeSettingsAudio(
  audioPrefs: Partial<AudioPrefs> | undefined,
  customSounds: CustomSound[],
): AudioPrefs {
  return normalizeAudioPrefs(
    {
      ...DEFAULT_AUDIO_PREFS,
      ...audioPrefs,
      volume: clampAudioVolume(audioPrefs?.volume ?? DEFAULT_AUDIO_PREFS.volume),
    },
    customSounds,
  );
}

const SETTINGS_STORAGE_KEY = "risebyday-settings";
migrateLocalStorageKey("daybyday-settings", SETTINGS_STORAGE_KEY);

function readLegacySettingsState(): Partial<SettingsState> | null {
  try {
    const raw = localStorage.getItem("daybyday-settings");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: Partial<SettingsState> };
    const state = parsed?.state ?? (parsed as Partial<SettingsState>);
    return state && Object.keys(state).length > 0 ? state : null;
  } catch {
    return null;
  }
}

function migrateLegacyKeys(): Partial<SettingsState> {
  const migrated: Partial<SettingsState> = {};

  try {
    const dt =
      localStorage.getItem("risebyday.home.day-transition.v1") ??
      localStorage.getItem("daybyday.home.day-transition.v1");
    if (dt === "true") migrated.dayTransitionEnabled = true;
    else if (dt === "false") migrated.dayTransitionEnabled = false;
  } catch {}

  try {
    const zoom =
      localStorage.getItem("rbd:zoom-level") ??
      localStorage.getItem("dbd:zoom-level");
    if (zoom) {
      const level = Number(zoom);
      if (Number.isFinite(level)) migrated.zoomLevel = level;
    }
  } catch {}

  try {
    const sidebar =
      localStorage.getItem("rbd-sidebar-state-v2") ??
      localStorage.getItem("dbd-sidebar-state-v2");
    if (sidebar) {
      const parsed = JSON.parse(sidebar);
      migrated.sidebar = { ...DEFAULT_SIDEBAR, ...parsed };
    }
  } catch {}

  try {
    const pinned =
      localStorage.getItem("rbd-toolkit-pinned-panels-v1") ??
      localStorage.getItem("dbd-toolkit-pinned-panels-v1");
    if (pinned) {
      const parsed = JSON.parse(pinned);
      if (Array.isArray(parsed)) migrated.pinnedToolkitPanels = parsed;
    }
  } catch {}

  try {
    const coords =
      localStorage.getItem("rbd.weather.manualCoords") ??
      localStorage.getItem("dbd.weather.manualCoords");
    if (coords) {
      const parsed = JSON.parse(coords);
      if (
        typeof parsed?.lat === "number" &&
        typeof parsed?.lon === "number" &&
        Number.isFinite(parsed.lat) &&
        Number.isFinite(parsed.lon)
      ) {
        migrated.weatherCoords = { lat: parsed.lat, lon: parsed.lon };
      }
    }
  } catch {}

  try {
    const blocks =
      localStorage.getItem("risebyday-block-configs") ??
      localStorage.getItem("daybyday-block-configs");
    if (blocks) {
      const parsed = JSON.parse(blocks);
      if (Array.isArray(parsed)) migrated.blockConfigs = parsed;
    }
  } catch {}

  try {
    const cats =
      localStorage.getItem("risebyday-category-configs") ??
      localStorage.getItem("daybyday-category-configs");
    if (cats) {
      const parsed = JSON.parse(cats);
      if (Array.isArray(parsed)) migrated.categoryConfigs = parsed;
    }
  } catch {}

  return migrated;
}

function cleanupLegacyKeys(): void {
  const keys = [
    "daybyday-settings",
    "daybyday.home.visual-prefs.v1",
    "daybyday.home.day-transition.v1",
    "dbd:zoom-level",
    "dbd-sidebar-state-v2",
    "dbd-toolkit-pinned-panels-v1",
    "dbd.weather.manualCoords",
    "dbd.blocks.userCss",
    "daybyday-block-configs",
    "daybyday-category-configs",
  ];
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      colorTheme: DEFAULT_COLOR_THEME_ID,
      customColorThemes: [],
      dayTransitionEnabled:
        typeof window !== "undefined"
          ? !window.matchMedia("(prefers-reduced-motion: reduce)").matches
          : true,
      motionLevel: "full",
      zoomLevel: 1,
      sidebar: DEFAULT_SIDEBAR,
      rightPanel: DEFAULT_RIGHT_PANEL,
      pinnedToolkitPanels: [],
      weatherCoords: null,
      audioPrefs: DEFAULT_AUDIO_PREFS,
      customSounds: [],
      blockConfigs: [],
      categoryConfigs: [],

      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      setColorTheme: (id) =>
        set((s) => {
          if (!findColorTheme(id, s.customColorThemes)) return s;
          applyColorTheme(id, s.customColorThemes);
          return { colorTheme: id };
        }),
      setCustomColorThemes: (customColorThemes) =>
        set((s) => {
          // The active theme's file was deleted or broke: fall back.
          const colorTheme = findColorTheme(s.colorTheme, customColorThemes)
            ? s.colorTheme
            : DEFAULT_COLOR_THEME_ID;
          applyColorTheme(colorTheme, customColorThemes);
          return { customColorThemes, colorTheme };
        }),
      addCustomColorTheme: (theme) =>
        set((s) => {
          const customColorThemes = [
            ...s.customColorThemes.filter((t) => t.id !== theme.id),
            theme,
          ];
          applyColorTheme(theme.id, customColorThemes);
          return { customColorThemes, colorTheme: theme.id };
        }),
      removeCustomColorTheme: (id) =>
        set((s) => {
          const customColorThemes = s.customColorThemes.filter((t) => t.id !== id);
          const colorTheme =
            s.colorTheme === id ? DEFAULT_COLOR_THEME_ID : s.colorTheme;
          applyColorTheme(colorTheme, customColorThemes);
          return { customColorThemes, colorTheme };
        }),
      setDayTransitionEnabled: (enabled) =>
        set({ dayTransitionEnabled: enabled }),
      setMotionLevel: (level) =>
        set({ motionLevel: normalizeMotionLevel(level) }),
      setZoomLevel: (level) => set({ zoomLevel: clampAppZoom(level) }),
      setSidebar: (partial) =>
        set((s) => ({ sidebar: { ...s.sidebar, ...partial } })),
      setRightPanel: (partial) =>
        set((s) => ({ rightPanel: { ...s.rightPanel, ...partial } })),
      setPinnedToolkitPanels: (panelIds) =>
        set({ pinnedToolkitPanels: panelIds }),
      setWeatherCoords: (coords) => set({ weatherCoords: coords }),
      setAudioPrefs: (prefs) =>
        set((s) => {
          const next =
            typeof prefs === "function" ? prefs(s.audioPrefs) : prefs;
          return {
            audioPrefs: normalizeSettingsAudio(next, s.customSounds),
          };
        }),
      addCustomSound: (sound) =>
        set((s) => ({
          customSounds: [...s.customSounds, sound],
          audioPrefs: normalizeSettingsAudio(
            {
              ...s.audioPrefs,
              taskClickSoundId: customSoundId(sound.id),
            },
            [...s.customSounds, sound],
          ),
        })),
      setCustomSounds: (customSounds, remap = {}) =>
        set((s) => {
          const keep = new Set(customSounds.map((sound) => sound.id));
          for (const sound of s.customSounds) {
            if (!keep.has(sound.id)) evictTaskClickSoundFromCache(customSoundId(sound.id));
          }
          const prefs = { ...s.audioPrefs };
          for (const key of ["taskClickSoundId", "taskUncheckSoundId", "taskCreateSoundId"] as const) {
            prefs[key] = remap[prefs[key]] ?? prefs[key];
          }
          return {
            customSounds,
            audioPrefs: normalizeSettingsAudio(prefs, customSounds),
          };
        }),
      removeCustomSound: (id) =>
        set((s) => {
          const customSounds = s.customSounds.filter((sound) => sound.id !== id);
          evictTaskClickSoundFromCache(customSoundId(id));
          return {
            customSounds,
            audioPrefs: normalizeSettingsAudio(s.audioPrefs, customSounds),
          };
        }),
      setBlockConfigs: (configs) => set({ blockConfigs: configs }),
      setCategoryConfigs: (configs) => set({ categoryConfigs: configs }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      partialize: (state) => ({
        theme: state.theme,
        colorTheme: state.colorTheme,
        customColorThemes: state.customColorThemes,
        dayTransitionEnabled: state.dayTransitionEnabled,
        motionLevel: state.motionLevel,
        zoomLevel: state.zoomLevel,
        sidebar: state.sidebar,
        rightPanel: state.rightPanel,
        pinnedToolkitPanels: state.pinnedToolkitPanels,
        weatherCoords: state.weatherCoords,
        audioPrefs: state.audioPrefs,
        // Folder-backed sounds keep only their metadata; the bytes stay on disk.
        customSounds: state.customSounds.map((sound) =>
          sound.fileName ? { ...sound, dataUrl: "" } : sound,
        ),
        blockConfigs: state.blockConfigs,
        categoryConfigs: state.categoryConfigs,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<SettingsState> | undefined;
        if (p && Object.keys(p).length > 0) {
          const customSounds = Array.isArray(p.customSounds) ? p.customSounds : [];
          return {
            ...current,
            ...p,
            theme: normalizeThemePreference(p.theme),
            colorTheme:
              typeof p.colorTheme === "string"
                ? p.colorTheme
                : DEFAULT_COLOR_THEME_ID,
            customColorThemes: normalizeCustomColorThemes(p.customColorThemes),
            motionLevel: normalizeMotionLevel(p.motionLevel),
            audioPrefs: normalizeSettingsAudio(p.audioPrefs, customSounds),
          } as SettingsState;
        }
        const previousSettings = readLegacySettingsState();
        if (previousSettings) {
          setTimeout(cleanupLegacyKeys, 1000);
          return { ...current, ...previousSettings } as SettingsState;
        }
        const legacy = migrateLegacyKeys();
        if (Object.keys(legacy).length > 0) {
          setTimeout(cleanupLegacyKeys, 1000);
          return { ...current, ...legacy } as SettingsState;
        }
        return current as SettingsState;
      },
    },
  ),
);

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === SETTINGS_STORAGE_KEY) {
      void useSettingsStore.persist.rehydrate();
    }
  });
}

export { MOTION_LEVELS };
export type { MotionLevel, RightPanelState, SidebarMode, SidebarState };
