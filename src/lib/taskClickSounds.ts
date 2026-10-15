import type { AudioPrefs, CustomSound } from "@/types";
import { useSettingsStore } from "@/stores/settingsStore";

export const BUILTIN_TASK_CLICK_SOUNDS = [
  {
    id: "happy",
    label: "Happy",
    src: new URL("../assets/defaultaudio/happy.mp3", import.meta.url).href,
  },
  {
    id: "chew",
    label: "Chew",
    src: new URL("../assets/defaultaudio/chew.mp3", import.meta.url).href,
  },
  {
    id: "piano",
    label: "Piano",
    src: new URL("../assets/defaultaudio/piano.mp3", import.meta.url).href,
  },
] as const;

export type BuiltinTaskClickSoundId =
  (typeof BUILTIN_TASK_CLICK_SOUNDS)[number]["id"];

export const DEFAULT_TASK_CLICK_SOUND_ID = "builtin:happy";
export const DEFAULT_TASK_UNCHECK_SOUND_ID = "builtin:chew";
export const DEFAULT_TASK_CREATE_SOUND_ID = "builtin:piano";

/** Sound id meaning "stay silent for this event". */
export const NO_SOUND_ID = "none";

export type TaskSoundEvent = "complete" | "uncheck" | "create";

type TaskSoundPrefKey =
  | "taskClickSoundId"
  | "taskUncheckSoundId"
  | "taskCreateSoundId";

export const TASK_SOUND_EVENTS: readonly {
  event: TaskSoundEvent;
  prefKey: TaskSoundPrefKey;
  label: string;
  description: string;
  defaultSoundId: string;
}[] = [
  {
    event: "complete",
    prefKey: "taskClickSoundId",
    label: "Complete task",
    description: "Plays when you check off a task.",
    defaultSoundId: DEFAULT_TASK_CLICK_SOUND_ID,
  },
  {
    event: "uncheck",
    prefKey: "taskUncheckSoundId",
    label: "Uncheck task",
    description: "Plays when you mark a completed task as not done.",
    defaultSoundId: DEFAULT_TASK_UNCHECK_SOUND_ID,
  },
  {
    event: "create",
    prefKey: "taskCreateSoundId",
    label: "Create task",
    description: "Plays when a new task is added.",
    defaultSoundId: DEFAULT_TASK_CREATE_SOUND_ID,
  },
];

function soundPrefKey(event: TaskSoundEvent): TaskSoundPrefKey {
  return TASK_SOUND_EVENTS.find((e) => e.event === event)!.prefKey;
}

/** Limit for sounds kept in localStorage (browser-only builds). */
export const MAX_CUSTOM_SOUND_BYTES = 512 * 1024;
/** Limit for sounds kept in the sounds folder; matches `user_sounds.rs`. */
export const MAX_FOLDER_SOUND_BYTES = 2 * 1024 * 1024;

const ACCEPTED_AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".webm",
]);

const audioCache = new Map<string, HTMLAudioElement>();

export function builtinSoundId(id: BuiltinTaskClickSoundId): string {
  return `builtin:${id}`;
}

export function customSoundId(id: string): string {
  return `custom:${id}`;
}

export function isValidTaskClickSoundId(
  soundId: string,
  customSounds: CustomSound[],
): boolean {
  if (soundId === NO_SOUND_ID) return true;
  if (soundId.startsWith("builtin:")) {
    const builtinId = soundId.slice("builtin:".length);
    return BUILTIN_TASK_CLICK_SOUNDS.some((sound) => sound.id === builtinId);
  }
  if (soundId.startsWith("custom:")) {
    const customId = soundId.slice("custom:".length);
    return customSounds.some((sound) => sound.id === customId);
  }
  return false;
}

export function normalizeAudioPrefs(
  prefs: Partial<AudioPrefs>,
  customSounds: CustomSound[],
): AudioPrefs {
  const volume =
    typeof prefs.volume === "number" && Number.isFinite(prefs.volume)
      ? Math.min(100, Math.max(0, Math.round(prefs.volume)))
      : 80;
  const pick = (soundId: string | undefined, fallback: string) =>
    soundId && isValidTaskClickSoundId(soundId, customSounds)
      ? soundId
      : fallback;

  return {
    soundEnabled: prefs.soundEnabled ?? true,
    volume,
    taskClickSoundId: pick(prefs.taskClickSoundId, DEFAULT_TASK_CLICK_SOUND_ID),
    taskUncheckSoundId: pick(
      prefs.taskUncheckSoundId,
      DEFAULT_TASK_UNCHECK_SOUND_ID,
    ),
    taskCreateSoundId: pick(
      prefs.taskCreateSoundId,
      DEFAULT_TASK_CREATE_SOUND_ID,
    ),
  };
}

export function resolveTaskClickSoundSrc(
  soundId: string,
  customSounds: CustomSound[],
): string | null {
  if (soundId.startsWith("builtin:")) {
    const builtinId = soundId.slice("builtin:".length);
    return (
      BUILTIN_TASK_CLICK_SOUNDS.find((sound) => sound.id === builtinId)?.src ??
      null
    );
  }

  if (soundId.startsWith("custom:")) {
    const customId = soundId.slice("custom:".length);
    return (
      customSounds.find((sound) => sound.id === customId)?.dataUrl ?? null
    );
  }

  return null;
}

export function getTaskClickSoundLabel(
  soundId: string,
  customSounds: CustomSound[],
): string {
  if (soundId === NO_SOUND_ID) return "None";
  if (soundId.startsWith("builtin:")) {
    const builtinId = soundId.slice("builtin:".length);
    return (
      BUILTIN_TASK_CLICK_SOUNDS.find((sound) => sound.id === builtinId)
        ?.label ?? "Built-in"
    );
  }

  if (soundId.startsWith("custom:")) {
    const customId = soundId.slice("custom:".length);
    return customSounds.find((sound) => sound.id === customId)?.name ?? "Custom";
  }

  return "Sound";
}

function getAudioForSound(soundId: string, src: string): HTMLAudioElement {
  let audio = audioCache.get(soundId);
  if (!audio) {
    audio = new Audio(src);
    audio.preload = "auto";
    audioCache.set(soundId, audio);
  } else if (audio.src !== src) {
    audio.src = src;
  }
  return audio;
}

export function evictTaskClickSoundFromCache(soundId: string): void {
  audioCache.delete(soundId);
}

function playSoundAtVolume(soundId: string, src: string, volume: number): void {
  if (typeof window === "undefined") return;

  const audio = getAudioForSound(soundId, src);
  audio.volume = Math.min(1, Math.max(0, volume / 100));
  audio.currentTime = 0;
  void audio.play().catch(() => {
    // Ignore autoplay / missing-output errors.
  });
}

export function playTaskSound(event: TaskSoundEvent): void {
  const { audioPrefs } = useSettingsStore.getState();
  previewTaskClickSound(audioPrefs[soundPrefKey(event)]);
}

export function previewTaskClickSound(
  soundId = useSettingsStore.getState().audioPrefs.taskClickSoundId,
): void {
  const { soundEnabled, volume, customSounds } = {
    ...useSettingsStore.getState().audioPrefs,
    customSounds: useSettingsStore.getState().customSounds,
  };

  if (!soundEnabled) return;

  const src = resolveTaskClickSoundSrc(soundId, customSounds);
  if (!src) return;

  playSoundAtVolume(soundId, src, volume);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read that audio file."));
    };
    reader.onerror = () => reject(new Error("Could not read that audio file."));
    reader.readAsDataURL(file);
  });
}

function getFileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

const MIME_BY_EXTENSION: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".webm": "audio/webm",
};

export function mimeTypeForFileName(name: string): string {
  return MIME_BY_EXTENSION[getFileExtension(name)] ?? "audio/mpeg";
}

/**
 * A file name safe for the sounds folder: no path characters, an accepted
 * audio extension (derived from the MIME type when missing), and not taken.
 */
export function soundFileNameFor(
  name: string,
  mimeType: string,
  taken: readonly string[],
): string {
  let ext = getFileExtension(name);
  if (!ACCEPTED_AUDIO_EXTENSIONS.has(ext)) {
    ext =
      Object.entries(MIME_BY_EXTENSION).find(([, mime]) => mime === mimeType)?.[0] ??
      ".mp3";
  }
  const stem =
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
      .replace(/^\.+/, "")
      .trim()
      .slice(0, 100) || "sound";
  const lowerTaken = new Set(taken.map((n) => n.toLowerCase()));
  let candidate = `${stem}${ext}`;
  for (let i = 2; lowerTaken.has(candidate.toLowerCase()); i++) {
    candidate = `${stem} (${i})${ext}`;
  }
  return candidate;
}

export function soundNameFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").trim() || "Custom sound";
}

export function isAcceptedAudioFile(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  return ACCEPTED_AUDIO_EXTENSIONS.has(getFileExtension(file.name));
}

export async function createCustomSoundFromFile(file: File): Promise<CustomSound> {
  if (!isAcceptedAudioFile(file)) {
    throw new Error("Choose an audio file (.mp3, .wav, .ogg, .m4a, or .aac).");
  }
  if (file.size > MAX_CUSTOM_SOUND_BYTES) {
    throw new Error("That file is too large. Keep custom sounds under 512 KB.");
  }

  const dataUrl = await readFileAsDataUrl(file);
  const baseName = file.name.replace(/\.[^.]+$/, "").trim();

  return {
    id: crypto.randomUUID(),
    name: baseName || "Custom sound",
    dataUrl,
    mimeType: file.type || "audio/mpeg",
  };
}
