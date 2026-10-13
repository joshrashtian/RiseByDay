/**
 * Owns the `dark` class on <html>.
 *
 * Tailwind's dark variant is wired to that class (see the `@custom-variant`
 * in App.css) rather than to `prefers-color-scheme`, so the user's explicit
 * choice can override the OS. "system" is the only mode that still follows it.
 */

export type ThemePreference = "light" | "dark" | "system";

export const THEME_PREFERENCES: ThemePreference[] = ["light", "dark", "system"];

const DARK_CLASS = "dark";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    value === "light" || value === "dark" || value === "system"
  );
}

export function normalizeThemePreference(value: unknown): ThemePreference {
  return isThemePreference(value) ? value : "system";
}

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(DARK_QUERY).matches;
}

/** The concrete appearance a preference resolves to right now. */
export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference === "system") return systemPrefersDark() ? "dark" : "light";
  return preference;
}

export function applyTheme(preference: ThemePreference): "light" | "dark" {
  const resolved = resolveTheme(preference);
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle(DARK_CLASS, resolved === "dark");
  }
  return resolved;
}

/** Calls back whenever the OS appearance flips. Returns an unsubscribe fn. */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export const SETTINGS_STORAGE_KEY = "risebyday-settings";

/**
 * Reads the persisted preference straight out of localStorage so the class is
 * on <html> before React paints. Without this the app renders one frame light.
 */
export function readPersistedThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return "system";
    const parsed = JSON.parse(raw) as { state?: { theme?: unknown } };
    return normalizeThemePreference(parsed?.state?.theme);
  } catch {
    return "system";
  }
}
