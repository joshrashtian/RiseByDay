import { useLayoutEffect, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Applies the Appearance → Animations setting.
 *
 * - full:    everything animates, unless macOS Reduce Motion is on.
 * - minimal: Framer Motion keeps fades but drops transform/layout movement.
 * - none:    Framer Motion jumps straight to the end state, and plain CSS
 *            transitions/keyframes are cut by the `data-motion` rule in App.css.
 */
export function MotionPreferenceProvider({ children }: { children: ReactNode }) {
  const motionLevel = useSettingsStore((s) => s.motionLevel);

  useLayoutEffect(() => {
    document.documentElement.dataset.motion = motionLevel;
  }, [motionLevel]);

  return (
    <MotionConfig
      reducedMotion={motionLevel === "full" ? "user" : "always"}
      skipAnimations={motionLevel === "none"}
    >
      {children}
    </MotionConfig>
  );
}
