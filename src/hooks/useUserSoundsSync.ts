import { useEffect } from "react";
import { useUserSoundsStore } from "@/stores/userSoundsStore";

/**
 * Rescans the sounds folder on mount and whenever the window regains focus,
 * so an audio file dropped into the folder from Finder shows up when you come
 * back. Unchanged files are not re-read.
 *
 * Mount once, near the root.
 */
export function useUserSoundsSync(): void {
  const reload = useUserSoundsStore((s) => s.reload);

  useEffect(() => {
    void reload();
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);
}
