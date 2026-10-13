import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauriEnv";
import {
  BUILT_IN_COLOR_THEMES,
  parseColorThemeFile,
} from "@/lib/colorThemes";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ColorThemeFile } from "@/types";


type ListingFile = { fileName: string; contents: string | null; error: string | null };
type Listing = { dir: string; files: ListingFile[] };

export type UserThemeEntry = {
  fileName: string;
  /** Set when the file parsed into a usable theme. */
  themeId?: string;
  errors?: string[];
};

type UserThemesState = {
  dir: string | null;
  entries: UserThemeEntry[];
  loading: boolean;
  error: string | null;
  createTheme: () => Promise<void>;
  /** Re-reads the folder and refreshes the settings-store cache. */
  reload: () => Promise<void>;
  /** Validates and copies a theme file into the folder. Returns errors, if any. */
  importFile: (file: File) => Promise<string[]>;
  deleteTheme: (themeId: string) => Promise<void>;
  openFolder: () => Promise<void>;
};

function parseListing(listing: Listing): {
  entries: UserThemeEntry[];
  themes: ColorThemeFile[];
} {
  const themes: ColorThemeFile[] = [];
  const entries = listing.files.map((file): UserThemeEntry => {
    if (file.contents == null) {
      return { fileName: file.fileName, errors: [file.error ?? "Couldn't read file"] };
    }
    let json: unknown;
    try {
      json = JSON.parse(file.contents);
    } catch {
      return { fileName: file.fileName, errors: ["Not valid JSON"] };
    }
    const result = parseColorThemeFile(json);
    if (!result.ok) return { fileName: file.fileName, errors: result.errors };
    const { id } = result.theme;
    if (BUILT_IN_COLOR_THEMES.some((t) => t.id === id)) {
      return { fileName: file.fileName, errors: [`"${id}" is a built-in theme id`] };
    }
    if (themes.some((t) => t.id === id)) {
      return { fileName: file.fileName, errors: [`Another file already uses the id "${id}"`] };
    }
    themes.push(result.theme);
    return { fileName: file.fileName, themeId: id };
  });
  return { entries, themes };
}

export const useUserThemesStore = create<UserThemesState>()((set, get) => ({
  dir: null,
  entries: [],
  loading: false,
  error: null,

  reload: async () => {
    if (!isTauri()) return;
    set({ loading: true });
    try {
      const listing = await invoke<Listing>("list_user_themes");
      const { entries, themes } = parseListing(listing);
      useSettingsStore.getState().setCustomColorThemes(themes);
      set({ dir: listing.dir, entries, loading: false, error: null });
    } catch (error) {
      set({ loading: false, error: String(error) });
    }
  },

  createTheme: async () => {
    if (!isTauri()) return;
    try {
      await invoke("create_new_theme");
    } catch (error) {
      set({ error: String(error) });
      return;
    }
    await get().reload();
    useSettingsStore.getState().setColorTheme("untitled-new-theme");
  },

  importFile: async (file) => {
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      return ["That file isn't valid JSON."];
    }
    const result = parseColorThemeFile(json);
    if (!result.ok) return result.errors;
    const theme = result.theme;
    if (BUILT_IN_COLOR_THEMES.some((t) => t.id === theme.id)) {
      return [`"${theme.id}" is a built-in theme id. Pick another id.`];
    }

    if (!isTauri()) {
      useSettingsStore.getState().addCustomColorTheme(theme);
      return [];
    }
    // Re-importing a theme overwrites the file that already holds its id.
    const fileName =
      get().entries.find((e) => e.themeId === theme.id)?.fileName ??
      `${theme.id}.json`;
    try {
      await invoke("save_user_theme", {
        fileName,
        contents: `${JSON.stringify(theme, null, 2)}\n`,
      });
    } catch (error) {
      return [String(error)];
    }
    await get().reload();
    useSettingsStore.getState().setColorTheme(theme.id);
    return [];
  },

  deleteTheme: async (themeId) => {
    if (!isTauri()) {
      useSettingsStore.getState().removeCustomColorTheme(themeId);
      return;
    }
    const entry = get().entries.find((e) => e.themeId === themeId);
    if (!entry) return;
    try {
      await invoke("delete_user_theme", { fileName: entry.fileName });
    } catch (error) {
      set({ error: String(error) });
    }
    await get().reload();
  },

  openFolder: async () => {
    if (!isTauri()) return;
    try {
      await invoke("open_user_themes_folder");
    } catch (error) {
      set({ error: String(error) });
    }
  },
}));
