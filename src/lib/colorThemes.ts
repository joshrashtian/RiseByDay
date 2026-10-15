/**
 * Color themes: JSON files that set the semantic tokens declared in App.css.
 *
 * A theme file is the source of truth for every token value. App.css only
 * declares the Tailwind mapping and component-token defaults; the values
 * themselves are injected here as a <style> tag, so `bg-surface` and friends
 * follow whichever theme is active. The `dark` class (owned by appTheme.ts)
 * still picks between a theme's light and dark palettes.
 *
 * Parsing and resolving are pure so a React Native client can reuse them and
 * map the resolved palette onto its own styles instead of CSS.
 */
import type {
  ColorThemeComponentToken,
  ColorThemeFile,
  ColorThemeToken,
} from "@/types";
import { SETTINGS_STORAGE_KEY } from "@/lib/appTheme";
import yachtClub from "@/themes/yacht-club.json";
import classic from "@/themes/classic.json";
import sanLuisObispo from "@/themes/san-luis-obispo.json";

export const COLOR_THEME_TOKENS: readonly ColorThemeToken[] = [
  "canvas", "surface", "raised", "sunken",
  "ink", "muted", "faint",
  "line", "line-strong",
  "accent", "accent-hover", "accent-soft", "accent-ink",
  "secondary", "secondary-soft",
  "danger", "danger-soft", "success", "success-soft", "warn", "warn-soft",
  "overlay",
];

export const COLOR_THEME_COMPONENT_TOKENS: readonly ColorThemeComponentToken[] = [
  "sidebar-bg", "sidebar-ink", "sidebar-ink-active",
  "sidebar-item-hover", "sidebar-item-active", "sidebar-line",
  "input-bg", "input-line", "input-focus",
  "card-bg", "card-line",
  "popover-bg",
];

export const BUILT_IN_COLOR_THEMES: readonly ColorThemeFile[] = [
  yachtClub as ColorThemeFile,
  classic as ColorThemeFile,
  sanLuisObispo as ColorThemeFile,
];

export const DEFAULT_COLOR_THEME_ID = "yacht-club";

type Mode = "light" | "dark";
type Palette = Partial<Record<ColorThemeToken, string>>;
type ComponentPalette = Partial<Record<ColorThemeComponentToken, string>>;

export type ResolvedColorTheme = {
  id: string;
  colors: Record<Mode, Palette>;
  components: Record<Mode, ComponentPalette>;
};

// ── Validation ──────────────────────────────────────────────────────────────

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC = /^(?:rgba?|hsla?)\(\s*[\d.%\s,/+-]+\)$/i;

/** Hex, rgb()/rgba() or hsl()/hsla() only — nothing that can load a URL. */
export function isSafeColor(value: unknown): value is string {
  return typeof value === "string" && (HEX.test(value) || FUNC.test(value));
}

const MAX_EXTENDS_DEPTH = 5;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,47}$/;

function pickColors<K extends string>(
  raw: unknown,
  allowed: readonly K[],
  path: string,
  errors: string[],
): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  if (raw == null) return out;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    errors.push(`${path} must be an object`);
    return out;
  }
  for (const [key, value] of Object.entries(raw)) {
    if (!(allowed as readonly string[]).includes(key)) {
      errors.push(`${path}.${key} is not a known token`);
    } else if (!isSafeColor(value)) {
      errors.push(`${path}.${key} must be a hex, rgb() or hsl() color`);
    } else {
      out[key as K] = value;
    }
  }
  return out;
}

export type ParseColorThemeResult =
  | { ok: true; theme: ColorThemeFile }
  | { ok: false; errors: string[] };

/** Validates untrusted JSON (an imported file) into a ColorThemeFile. */
export function parseColorThemeFile(raw: unknown): ParseColorThemeResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["Theme must be a JSON object"] };
  }
  const r = raw as Record<string, unknown>;

  if (r.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (typeof r.id !== "string" || !ID_PATTERN.test(r.id)) {
    errors.push("id must be lowercase letters, numbers and dashes");
  }
  if (typeof r.name !== "string" || !r.name.trim()) {
    errors.push("name is required");
  }
  const appearance = r.appearance ?? "both";
  if (appearance !== "light" && appearance !== "dark" && appearance !== "both") {
    errors.push('appearance must be "light", "dark" or "both"');
  }
  if (r.extends !== undefined && typeof r.extends !== "string") {
    errors.push("extends must be a theme id");
  }

  const colorsRaw = (r.colors ?? {}) as Record<string, unknown>;
  const componentsRaw = (r.components ?? {}) as Record<string, unknown>;
  const colors = {
    light: pickColors(colorsRaw.light, COLOR_THEME_TOKENS, "colors.light", errors),
    dark: pickColors(colorsRaw.dark, COLOR_THEME_TOKENS, "colors.dark", errors),
  };
  const components = {
    light: pickColors(componentsRaw.light, COLOR_THEME_COMPONENT_TOKENS, "components.light", errors),
    dark: pickColors(componentsRaw.dark, COLOR_THEME_COMPONENT_TOKENS, "components.dark", errors),
  };

  const categoryPalette = Array.isArray(r.categoryPalette)
    ? r.categoryPalette.filter(isSafeColor)
    : undefined;

  if (errors.length > 0) return { ok: false, errors };

  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 200) : undefined);
  return {
    ok: true,
    theme: {
      schemaVersion: 1,
      id: r.id as string,
      name: (r.name as string).trim().slice(0, 60),
      author: str(r.author),
      version: str(r.version),
      description: str(r.description),
      appearance: appearance as ColorThemeFile["appearance"],
      extends: r.extends as string | undefined,
      colors,
      components,
      categoryPalette,
    },
  };
}

// ── Resolving ───────────────────────────────────────────────────────────────

export function findColorTheme(
  id: string,
  customThemes: readonly ColorThemeFile[] = [],
): ColorThemeFile | undefined {
  return (
    customThemes.find((t) => t.id === id) ??
    BUILT_IN_COLOR_THEMES.find((t) => t.id === id)
  );
}

/** Tokens derived from a base color when a theme leaves them out. */
const SOFT_TOKENS: [ColorThemeToken, ColorThemeToken][] = [
  ["accent-soft", "accent"],
  ["secondary-soft", "secondary"],
  ["danger-soft", "danger"],
  ["success-soft", "success"],
  ["warn-soft", "warn"],
];

function withAlpha(color: string, alpha: number): string {
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? hex.replace(/./g, "$&$&") : hex;
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  return `color-mix(in srgb, ${color} ${alpha * 100}%, transparent)`;
}

/**
 * Flattens a theme and its `extends` chain into one palette per mode. The
 * default theme is always the last link, so every token ends up set. A theme
 * that only supports one appearance uses that palette for both modes.
 */
export function resolveColorTheme(
  id: string,
  customThemes: readonly ColorThemeFile[] = [],
): ResolvedColorTheme {
  const chain: ColorThemeFile[] = [];
  const seen = new Set<string>();
  let next: string | undefined = id;
  while (next && !seen.has(next) && chain.length < MAX_EXTENDS_DEPTH) {
    seen.add(next);
    const theme = findColorTheme(next, customThemes);
    if (!theme) break;
    chain.push(theme);
    next = theme.extends;
  }
  if (!seen.has(DEFAULT_COLOR_THEME_ID)) {
    chain.push(findColorTheme(DEFAULT_COLOR_THEME_ID)!);
  }

  const resolved: ResolvedColorTheme = {
    id: chain[0]?.id ?? DEFAULT_COLOR_THEME_ID,
    colors: { light: {}, dark: {} },
    components: { light: {}, dark: {} },
  };

  // Walk base → leaf so the leaf's values win.
  for (const theme of [...chain].reverse()) {
    for (const mode of ["light", "dark"] as const) {
      const source: Mode =
        theme.appearance === "both" ? mode : theme.appearance;
      Object.assign(resolved.colors[mode], theme.colors[source]);
      Object.assign(resolved.components[mode], theme.components?.[source]);
    }
  }

  // Re-derive soft tokens the leaf theme didn't set itself, so a theme that
  // only changes `accent` doesn't inherit its parent's accent-soft.
  const leaf = chain[0];
  for (const mode of ["light", "dark"] as const) {
    const leafColors =
      leaf?.colors[leaf.appearance === "both" ? mode : leaf.appearance] ?? {};
    for (const [soft, base] of SOFT_TOKENS) {
      const baseValue = resolved.colors[mode][base];
      if (!leafColors[soft] && leafColors[base] && baseValue) {
        resolved.colors[mode][soft] = withAlpha(baseValue, mode === "light" ? 0.1 : 0.16);
      }
    }
  }

  return resolved;
}

// ── Applying (web) ──────────────────────────────────────────────────────────

const STYLE_ID = "color-theme";

function declarations(palette: Record<string, string | undefined>): string {
  return Object.entries(palette)
    .filter((entry): entry is [string, string] => isSafeColor(entry[1]))
    .map(([token, value]) => `--${token}:${value};`)
    .join("");
}

/**
 * `:root:root` outranks the component-token defaults on `:root` in App.css,
 * whatever order the two stylesheets end up in.
 */
export function buildColorThemeCss(theme: ResolvedColorTheme): string {
  return (
    `:root:root{${declarations(theme.colors.light)}${declarations(theme.components.light)}}` +
    `:root:root.dark{${declarations(theme.colors.dark)}${declarations(theme.components.dark)}}`
  );
}

export function applyColorTheme(
  id: string,
  customThemes: readonly ColorThemeFile[] = [],
): void {
  if (typeof document === "undefined") return;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = buildColorThemeCss(resolveColorTheme(id, customThemes));
}

/** Same pre-paint trick as readPersistedThemePreference in appTheme.ts. */
export function readPersistedColorTheme(): {
  id: string;
  customThemes: ColorThemeFile[];
} {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const state = raw
      ? (JSON.parse(raw) as {
          state?: { colorTheme?: unknown; customColorThemes?: unknown };
        }).state
      : undefined;
    return {
      id: typeof state?.colorTheme === "string" ? state.colorTheme : DEFAULT_COLOR_THEME_ID,
      customThemes: normalizeCustomColorThemes(state?.customColorThemes),
    };
  } catch {
    return { id: DEFAULT_COLOR_THEME_ID, customThemes: [] };
  }
}

/** Re-validates persisted custom themes; drops anything that no longer parses. */
export function normalizeCustomColorThemes(value: unknown): ColorThemeFile[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const result = parseColorThemeFile(item);
    return result.ok ? [result.theme] : [];
  });
}
