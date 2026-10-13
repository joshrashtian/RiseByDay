import type { ReactNode } from "react";
import { IoListOutline, IoPeople } from "react-icons/io5";
import type { SidebarMode } from "../../../stores/settingsStore";

type Props = {
  showLabel: boolean;
  sidebarMode: SidebarMode;
  setSidebarMode: (mode: SidebarMode) => void;
};

const getNextSidebarMode = (current: SidebarMode): SidebarMode => {
  if (current === "tasks") return "social";
  if (current === "social") return "tasks";
  return "tasks";
};

const MODES: { id: SidebarMode; icon: ReactNode }[] = [
  { id: "tasks", icon: <IoListOutline /> },
  { id: "social", icon: <IoPeople /> },
  // { id: "apps", icon: <IoApps /> },
];

export function SidebarModeToggle({
  showLabel,
  sidebarMode,
  setSidebarMode,
}: Props) {
  if (!showLabel) {
    return (
      <button
        type="button"
        onClick={() => setSidebarMode(getNextSidebarMode(sidebarMode))}
        className="inline-flex h-9 w-full bg-sidebar-item-hover items-center justify-center rounded-lg text-base text-sidebar-ink transition-colors hover:text-sidebar-ink-active"
        aria-label="Toggle navigation mode"
        title="Toggle navigation mode"
      >
        {MODES.find((m) => m.id === sidebarMode)?.icon}
      </button>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-1">
      {MODES.map(({ id, icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setSidebarMode(id)}
          className={`inline-flex h-9 items-center justify-center rounded-lg text-base transition-colors ${
            sidebarMode === id
              ? "bg-ink text-surface"
              : "text-sidebar-ink hover:bg-sidebar-item-hover hover:text-sidebar-ink-active"
          }`}
          aria-pressed={sidebarMode === id}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
