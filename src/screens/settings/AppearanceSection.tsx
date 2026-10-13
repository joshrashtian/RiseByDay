import { IoContrast, IoMoon, IoSparkles, IoSunny } from "react-icons/io5";
import Container from "@/ui/settings/Container";
import SettingsHeader from "@/ui/settings/Header";
import { useId } from "react";
import {
  MOTION_LEVELS,
  useSettingsStore,
  type MotionLevel,
} from "@/stores/settingsStore";
import type { ThemePreference } from "@/lib/appTheme";
import { ColorThemePicker } from "./ColorThemePicker";

const OPTIONS: {
  id: ThemePreference;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "light",
    label: "Light",
    description: "Always light, whatever the system is set to.",
    icon: <IoSunny />,
  },
  {
    id: "dark",
    label: "Dark",
    description: "Always dark, whatever the system is set to.",
    icon: <IoMoon />,
  },
  {
    id: "system",
    label: "System",
    description: "Follow your macOS appearance setting.",
    icon: <IoContrast />,
  },
];

const MOTION_COPY: Record<MotionLevel, { label: string; description: string }> =
  {
    none: {
      label: "None",
      description: "Every change happens instantly — no animation at all.",
    },
    minimal: {
      label: "Minimal",
      description: "Gentle fades only. Nothing slides, scales or bounces.",
    },
    full: {
      label: "Animated",
      description:
        "The full experience. Your macOS Reduce Motion setting is still respected.",
    },
  };

export function AppearanceSection() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const motionLevel = useSettingsStore((s) => s.motionLevel);
  const setMotionLevel = useSettingsStore((s) => s.setMotionLevel);
  const motionSliderId = useId();
  const motionIndex = MOTION_LEVELS.indexOf(motionLevel);

  return (
    <div className="space-y-5">
      <SettingsHeader>
        <div>
        <SettingsHeader.Title>
          Appearance
        </SettingsHeader.Title>
        <SettingsHeader.Subtitle>
          Choose how RiseByDay looks.
        </SettingsHeader.Subtitle>
        </div>
      </SettingsHeader>

      <Container>
        <Container.Header icon={<IoContrast />} heading="Theme" />
        <Container.Body className="px-4 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {OPTIONS.map((option) => {
            const selected = theme === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTheme(option.id)}
                aria-pressed={selected}
                className={`flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-colors ${
                  selected
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-surface hover:border-line-strong"
                }`}
              >
                <span
                  className={`text-xl ${selected ? "text-accent" : "text-muted"}`}
                  aria-hidden
                >
                  {option.icon}
                </span>
                <span className="text-sm font-semibold text-ink">
                  {option.label}
                </span>
                <span className="text-[11px] leading-snug text-muted">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
        </Container.Body>
      </Container>

      <ColorThemePicker />

      <Container>
        <Container.Header icon={<IoSparkles />} heading="Motion" />
        <Container.Body className="px-4 py-4">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <label
                htmlFor={motionSliderId}
                className="text-sm font-semibold text-ink"
              >
                Animations
              </label>
              <span className="text-xs font-semibold text-muted">
                {MOTION_COPY[motionLevel].label}
              </span>
            </div>
            <input
              id={motionSliderId}
              type="range"
              min={0}
              max={MOTION_LEVELS.length - 1}
              step={1}
              value={motionIndex}
              aria-valuetext={MOTION_COPY[motionLevel].label}
              onChange={(event) =>
                setMotionLevel(MOTION_LEVELS[Number(event.target.value)])
              }
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-sunken accent-violet-600 dark:accent-violet-400"
            />
            <div className="flex justify-between text-[11px] font-semibold">
              {MOTION_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  tabIndex={-1}
                  onClick={() => setMotionLevel(level)}
                  className={
                    level === motionLevel
                      ? "text-ink"
                      : "text-muted hover:text-ink"
                  }
                >
                  {MOTION_COPY[level].label}
                </button>
              ))}
            </div>
            <p className="text-[11px] leading-snug text-muted">
              {MOTION_COPY[motionLevel].description}
            </p>
          </div>
        </Container.Body>
      </Container>
    </div>
  );
}

