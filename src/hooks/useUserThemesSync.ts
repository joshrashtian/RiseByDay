import { useEffect } from "react";
import { useUserThemesStore } from "@/stores/userThemesStore";

/**
 * Rescans the themes folder on mount and whenever the window regains focus,
 * so a file dropped into the folder from Finder shows up when you come back.
 *
 * Mount once, near the root.
 */
export function useUserThemesSync(): void {
  const reload = useUserThemesStore((s) => s.reload);

  useEffect(() => {
    void reload();
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);
}
