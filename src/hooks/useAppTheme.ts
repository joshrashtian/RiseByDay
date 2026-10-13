import { useEffect } from "react";
import { applyTheme, watchSystemTheme } from "@/lib/appTheme";
import { applyColorTheme } from "@/lib/colorThemes";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Keeps the `dark` class on <html> in sync with the stored preference, and —
 * while the preference is "system" — with the OS appearance as it changes.
 * Also re-applies the color theme, so a change made in another window (which
 * reaches this one through the store's storage-event rehydrate) shows here.
 *
 * Mount once, near the root.
 */
export function useAppTheme(): void {
  const theme = useSettingsStore((s) => s.theme);
  const colorTheme = useSettingsStore((s) => s.colorTheme);
  const customColorThemes = useSettingsStore((s) => s.customColorThemes);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    return watchSystemTheme(() => applyTheme("system"));
  }, [theme]);

  useEffect(() => {
    applyColorTheme(colorTheme, customColorThemes);
  }, [colorTheme, customColorThemes]);
}
