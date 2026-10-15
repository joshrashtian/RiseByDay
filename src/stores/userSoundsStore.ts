import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauriEnv";
import {
  MAX_CUSTOM_SOUND_BYTES,
  MAX_FOLDER_SOUND_BYTES,
  createCustomSoundFromFile,
  customSoundId,
  isAcceptedAudioFile,
  mimeTypeForFileName,
  soundFileNameFor,
  soundNameFromFileName,
} from "@/lib/taskClickSounds";
import { useSettingsStore } from "@/stores/settingsStore";
import type { CustomSound } from "@/types";

type ListingFile = {
  fileName: string;
  size: number;
  modified: number;
  error: string | null;
};
type Listing = { dir: string; files: ListingFile[] };

export type UserSoundEntry = {
  fileName: string;
  error?: string;
};

type UserSoundsState = {
  dir: string | null;
  entries: UserSoundEntry[];
  loading: boolean;
  error: string | null;
  /** Re-reads the folder and refreshes the settings-store sound list. */
  reload: () => Promise<void>;
  /** Copies an audio file into the folder and selects it. Returns the sound. */
  importFile: (file: File) => Promise<CustomSound>;
  deleteSound: (soundId: string) => Promise<void>;
  openFolder: () => Promise<void>;
};

/** Blob URLs for files already read, keyed by file name. */
const blobCache = new Map<string, { stamp: string; url: string }>();

async function saveSoundFile(fileName: string, bytes: ArrayBuffer): Promise<void> {
  await invoke("save_user_sound", new Uint8Array(bytes), {
    headers: { "x-file-name": encodeURIComponent(fileName) },
  });
}

/**
 * Moves sounds that were imported before the sounds folder existed (stored as
 * data URLs in localStorage) into the folder. Returns old id → new id, and the
 * sounds that could not be moved so they aren't lost.
 */
async function migrateLegacySounds(taken: string[]): Promise<{
  remap: Record<string, string>;
  failed: CustomSound[];
}> {
  const remap: Record<string, string> = {};
  const failed: CustomSound[] = [];
  const legacy = useSettingsStore
    .getState()
    .customSounds.filter((sound) => !sound.fileName && sound.dataUrl.startsWith("data:"));
  for (const sound of legacy) {
    try {
      const fileName = soundFileNameFor(sound.name, sound.mimeType, taken);
      const bytes = await (await fetch(sound.dataUrl)).arrayBuffer();
      await saveSoundFile(fileName, bytes);
      taken.push(fileName);
      remap[customSoundId(sound.id)] = customSoundId(fileName);
    } catch {
      failed.push(sound);
    }
  }
  return { remap, failed };
}

async function soundUrl(file: ListingFile): Promise<string> {
  const stamp = `${file.size}:${file.modified}`;
  const cached = blobCache.get(file.fileName);
  if (cached?.stamp === stamp) return cached.url;
  const bytes = await invoke<ArrayBuffer>("read_user_sound", { fileName: file.fileName });
  const url = URL.createObjectURL(
    new Blob([bytes], { type: mimeTypeForFileName(file.fileName) }),
  );
  if (cached) URL.revokeObjectURL(cached.url);
  blobCache.set(file.fileName, { stamp, url });
  return url;
}

let inflight: Promise<void> | null = null;

export const useUserSoundsStore = create<UserSoundsState>()((set, get) => ({
  dir: null,
  entries: [],
  loading: false,
  error: null,

  reload: () => {
    if (!isTauri()) return Promise.resolve();
    // Focus events can stack up; one scan at a time is plenty.
    inflight ??= (async () => {
      set({ loading: true });
      try {
        let listing = await invoke<Listing>("list_user_sounds");
        const { remap, failed } = await migrateLegacySounds(
          listing.files.map((f) => f.fileName),
        );
        if (Object.keys(remap).length > 0) {
          listing = await invoke<Listing>("list_user_sounds");
        }

        const sounds: CustomSound[] = [];
        const entries: UserSoundEntry[] = [];
        for (const file of listing.files) {
          if (file.error) {
            entries.push({ fileName: file.fileName, error: file.error });
            continue;
          }
          try {
            sounds.push({
              id: file.fileName,
              name: soundNameFromFileName(file.fileName),
              dataUrl: await soundUrl(file),
              mimeType: mimeTypeForFileName(file.fileName),
              fileName: file.fileName,
            });
            entries.push({ fileName: file.fileName });
          } catch (error) {
            entries.push({ fileName: file.fileName, error: String(error) });
          }
        }

        const present = new Set(listing.files.map((f) => f.fileName));
        for (const [fileName, { url }] of blobCache) {
          if (!present.has(fileName)) {
            URL.revokeObjectURL(url);
            blobCache.delete(fileName);
          }
        }

        useSettingsStore.getState().setCustomSounds([...sounds, ...failed], remap);
        set({ dir: listing.dir, entries, loading: false, error: null });
      } catch (error) {
        set({ loading: false, error: String(error) });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  importFile: async (file) => {
    if (!isAcceptedAudioFile(file)) {
      throw new Error("Choose an audio file (.mp3, .wav, .ogg, .m4a, or .aac).");
    }

    if (!isTauri()) {
      if (file.size > MAX_CUSTOM_SOUND_BYTES) {
        throw new Error("That file is too large. Keep custom sounds under 512 KB.");
      }
      const sound = await createCustomSoundFromFile(file);
      useSettingsStore.getState().addCustomSound(sound);
      return sound;
    }

    if (file.size > MAX_FOLDER_SOUND_BYTES) {
      throw new Error("That file is too large. Keep custom sounds under 2 MB.");
    }
    // Re-importing a file with the same name replaces it instead of adding a copy.
    const fileName = soundFileNameFor(file.name, file.type, []);
    await saveSoundFile(fileName, await file.arrayBuffer());
    await get().reload();

    const settings = useSettingsStore.getState();
    const sound = settings.customSounds.find((s) => s.id === fileName);
    if (!sound) throw new Error("Saved the file but couldn't load it back.");
    settings.setAudioPrefs((prev) => ({
      ...prev,
      taskClickSoundId: customSoundId(sound.id),
    }));
    return sound;
  },

  deleteSound: async (soundId) => {
    const sound = useSettingsStore
      .getState()
      .customSounds.find((s) => s.id === soundId);
    if (!sound) return;
    if (!sound.fileName || !isTauri()) {
      useSettingsStore.getState().removeCustomSound(soundId);
      return;
    }
    try {
      await invoke("delete_user_sound", { fileName: sound.fileName });
    } catch (error) {
      set({ error: String(error) });
    }
    await get().reload();
  },

  openFolder: async () => {
    if (!isTauri()) return;
    try {
      await invoke("open_user_sounds_folder");
    } catch (error) {
      set({ error: String(error) });
    }
  },
}));
