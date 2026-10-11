import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IoApps,
  IoCalendarOutline,
  IoChevronBack,
  IoChevronForward,
  IoGrid,
  IoFolderOutline,
  IoHelpCircleOutline,
  IoHomeOutline,
  IoHourglassOutline,
  IoListOutline,
  IoPeople,
  IoPersonOutline,
  IoSettingsOutline,
} from "react-icons/io5";
import { NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, Reorder, motion } from "motion/react";
import spotifyIcon from "../../assets/spotifysvg.svg";
import { TOOLKIT_PANELS } from "../../lib/toolkitPanels";
import {
  SIDEBAR_RAIL_WIDTH,
  clampSidebarWidthToViewport,
  resolveOverlayPanelWidth,
  resolveSidebarLayoutMode,
  type SidebarLayoutMode,
} from "../../lib/sidebarLayout";
import { useAppViewportWidth } from "../../hooks/useAppViewportWidth";
import { useSettingsStore } from "../../stores/settingsStore";
import type { SidebarMode } from "../../stores/settingsStore";
import {
  SidebarNavItemView,
  type SidebarNavItem,
} from "./sidebar/SidebarNavItem";
import { SidebarModeToggle } from "./sidebar/SidebarModeToggle";
import { sidebarTokens } from "./sidebar/sidebarTokens";
import { listen } from "@tauri-apps/api/event";
import { PROJECTS_ENABLED } from "@/lib/featureFlags";

const taskDefaultNavItems: SidebarNavItem[] = [
  { label: "Home", icon: <IoHomeOutline />, link: "/" },
  { label: "Tasks", icon: <IoListOutline />, link: "/tasks" },
  ...(PROJECTS_ENABLED
    ? [{ label: "Projects", icon: <IoFolderOutline />, link: "/projects" }]
    : []),
  { label: "Calendar", icon: <IoCalendarOutline />, link: "/calendar" },
  { label: "Pomodoro", icon: <IoHourglassOutline />, link: "/pomodoro" },
];

const socialDefaultNavItems: SidebarNavItem[] = [
  {
    label: "My Circle",
    icon: <IoPeople />,
    link: "/social/home",
  },
];

const buildPinnedPanelNavItems = (panelIds: string[]): SidebarNavItem[] => {
  const panelById = new Map(TOOLKIT_PANELS.map((panel) => [panel.id, panel]));
  return panelIds
    .map((panelId) => panelById.get(panelId))
    .filter((panel): panel is (typeof TOOLKIT_PANELS)[number] => Boolean(panel))
    .map((panel) => ({
      label: panel.label,
      icon:
        panel.id === "spotify" ? (
          <img src={spotifyIcon} alt="" className="h-5 w-5" aria-hidden />
        ) : (
          <IoGrid />
        ),
      link: panel.route,
    }));
};

const SNAP_WIDTHS = [220, 240, 320, 520] as const;
const DEFAULT_SIDEBAR_WIDTH = SNAP_WIDTHS[0];
const LABEL_REVEAL_WIDTH = 180;
const MIN_EXPANDED_WIDTH = SNAP_WIDTHS[0] - 16;
const MAX_EXPANDED_WIDTH = SNAP_WIDTHS[3] + 16;
const SWIPE_CLOSE_THRESHOLD = 56;
const EDGE_SWIPE_OPEN_THRESHOLD = 48;
const EDGE_SWIPE_ZONE_WIDTH = 28;
// Dragging the resize handle left of this collapses the sidebar to icons only.
const COMPACT_SNAP_WIDTH = 140;

type SideBarProps = {
  onWidthChange?: (width: number) => void;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
};

const clampExpandedWidth = (value: number) =>
  Math.min(MAX_EXPANDED_WIDTH, Math.max(MIN_EXPANDED_WIDTH, value));

const getNearestSnapWidth = (value: number) =>
  SNAP_WIDTHS.reduce((closest, width) =>
    Math.abs(width - value) < Math.abs(closest - value) ? width : closest,
  );

const restoreOrderedItems = (
  defaults: SidebarNavItem[],
  orderedLinks?: string[],
): SidebarNavItem[] => {
  if (!Array.isArray(orderedLinks) || orderedLinks.length === 0) {
    return defaults;
  }
  const map = new Map(defaults.map((item) => [item.link, item] as const));
  const restored = orderedLinks
    .map((link) => map.get(link))
    .filter((item): item is SidebarNavItem => Boolean(item));
  const missing = defaults.filter((item) => !orderedLinks.includes(item.link));
  return restored.length > 0 ? [...restored, ...missing] : defaults;
};

const SideBar = ({
  onWidthChange,
  onOpenProfile,
  onOpenSettings,
}: SideBarProps) => {
  const pinnedPanelIds = useSettingsStore((s) => s.pinnedToolkitPanels);
  const sidebarState = useSettingsStore((s) => s.sidebar);
  const setSidebarState = useSettingsStore((s) => s.setSidebar);

  const appDefaultNavItems = useMemo(
    () => [
      { label: "Toolbox", icon: <IoApps />, link: "/toolkit" },
      ...buildPinnedPanelNavItems(pinnedPanelIds),
    ],
    [pinnedPanelIds],
  );
  // The user's own open/closed preference. Auto-collapsing at narrow widths is
  // layered on top of this so shrinking the window never rewrites the pref.
  const [manualOpen, setManualOpen] = useState(sidebarState.open);
  // Transient: the sidebar is floating over content in overlay mode.
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(
    getNearestSnapWidth(sidebarState.width || DEFAULT_SIDEBAR_WIDTH),
  );
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  // Icon-only by choice. Distinct from the automatic rail at narrow widths.
  const [compact, setCompact] = useState(sidebarState.compact ?? false);
  const [dragX, setDragX] = useState<number | null>(null);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(
    sidebarState.mode,
  );
  const [taskItems, setTaskItems] = useState<SidebarNavItem[]>(() =>
    restoreOrderedItems(taskDefaultNavItems, sidebarState.taskOrder),
  );
  const [socialItems, setSocialItems] = useState<SidebarNavItem[]>(() =>
    restoreOrderedItems(socialDefaultNavItems, sidebarState.socialOrder),
  );
  const [appItems, setAppItems] = useState<SidebarNavItem[]>(() =>
    restoreOrderedItems(appDefaultNavItems, sidebarState.appOrder),
  );
  const [isResizing, setIsResizing] = useState(false);
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const [edgeSwipeStartX, setEdgeSwipeStartX] = useState<number | null>(null);

  const viewportWidth = useAppViewportWidth();
  const [layoutMode, setLayoutMode] = useState<SidebarLayoutMode>(() =>
    resolveSidebarLayoutMode(viewportWidth),
  );

  useEffect(() => {
    setLayoutMode((previous) =>
      resolveSidebarLayoutMode(viewportWidth, previous),
    );
  }, [viewportWidth]);

  const isOverlay = layoutMode === "overlay";
  // The user's compact preference only applies when the window could expand;
  // narrower windows already force the rail or overlay.
  const canExpand = layoutMode === "expanded";
  const isDraggingToCompact = dragX !== null && dragX < COMPACT_SNAP_WIDTH;
  const isRail =
    layoutMode === "rail" ||
    (canExpand && (dragX === null ? compact : isDraggingToCompact));
  const effectiveLayoutMode: SidebarLayoutMode = isRail ? "rail" : layoutMode;
  const sidebarOpen = isOverlay ? overlayOpen : manualOpen;

  const openSidebar = useCallback(() => {
    if (isOverlay) setOverlayOpen(true);
    else setManualOpen(true);
  }, [isOverlay]);

  const closeSidebar = useCallback(() => {
    if (isOverlay) setOverlayOpen(false);
    else setManualOpen(false);
  }, [isOverlay]);

  const toggleSidebar = useCallback(() => {
    if (isOverlay) setOverlayOpen((prev) => !prev);
    else setManualOpen((prev) => !prev);
  }, [isOverlay]);

  // Leaving overlay mode hands control back to the persisted preference.
  useEffect(() => {
    if (!isOverlay) setOverlayOpen(false);
  }, [isOverlay]);

  // A floating sidebar covers the page, so dismiss it once the user navigates.
  const location = useLocation();
  const lastPathRef = useRef(location.pathname);
  useEffect(() => {
    if (lastPathRef.current === location.pathname) return;
    lastPathRef.current = location.pathname;
    setOverlayOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isOverlay || !overlayOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOverlayOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isOverlay, overlayOpen]);

  useEffect(() => {
    setAppItems((previous) =>
      restoreOrderedItems(
        appDefaultNavItems,
        previous.map((item) => item.link),
      ),
    );
  }, [appDefaultNavItems]);

  useEffect(() => {
    const unlisten = listen("toggle-left-panel", () => {
      toggleSidebar();
    });
    return () => {
      unlisten.then((off) => off());
    };
  }, [toggleSidebar]);

  useEffect(() => {
    setSidebarState({
      open: manualOpen,
      width: sidebarWidth,
      mode: sidebarMode,
      taskOrder: taskItems.map((item) => item.link),
      socialOrder: socialItems.map((item) => item.link),
      appOrder: appItems.map((item) => item.link),
      compact,
    });
  }, [
    appItems,
    compact,
    manualOpen,
    sidebarMode,
    sidebarWidth,
    socialItems,
    taskItems,
    setSidebarState,
  ]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key !== "\\") return;
      if (!(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      toggleSidebar();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [toggleSidebar]);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      setDragX(event.clientX);
      setPreviewWidth(clampExpandedWidth(event.clientX - 8));
    };

    const handlePointerUp = () => {
      if (dragX !== null && dragX < COMPACT_SNAP_WIDTH) {
        setCompact(true);
      } else if (previewWidth !== null) {
        setCompact(false);
        setSidebarWidth(getNearestSnapWidth(previewWidth));
      }
      setPreviewWidth(null);
      setDragX(null);
      setIsResizing(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragX, isResizing, previewWidth]);

  const expandedWidth = clampSidebarWidthToViewport(
    previewWidth ?? sidebarWidth,
    viewportWidth,
  );
  const resolvedWidth = isRail
    ? SIDEBAR_RAIL_WIDTH
    : isOverlay
      ? resolveOverlayPanelWidth(sidebarWidth, viewportWidth)
      : expandedWidth;

  // In overlay mode the sidebar floats, so it claims no room in the layout.
  const layoutOffset = isOverlay || !sidebarOpen ? 0 : resolvedWidth;
  useEffect(() => {
    onWidthChange?.(layoutOffset);
  }, [layoutOffset, onWidthChange]);

  const showLabel =
    sidebarOpen && !isRail && resolvedWidth >= LABEL_REVEAL_WIDTH;
  const activeItems =
    sidebarMode === "tasks"
      ? taskItems
      : sidebarMode === "social"
        ? socialItems
        : appItems;

  return (
    <>
      <AnimatePresence>
        {isOverlay && sidebarOpen ? (
          <motion.div
            key="sidebar-scrim"
            className="fixed inset-0 z-40 bg-overlay backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            onPointerDown={() => setOverlayOpen(false)}
            aria-hidden
          />
        ) : null}
      </AnimatePresence>
      <div
        data-sidebar-layout={effectiveLayoutMode}
        className="fixed inset-y-0 left-0 z-50 flex items-stretch"
      >
        <AnimatePresence initial={false} mode="wait">
          {sidebarOpen ? (
            <motion.nav
              key="sidebar-nav"
              aria-label="Primary navigation"
              className={`relative flex h-full justify-between flex-col overflow-hidden pt-9 pb-3 bg-zinc-200/80 dark:bg-zinc-950/10 ${
                isRail ? "px-2" : "px-3"
              } ${sidebarTokens.surface} border-r border-line`}
              style={{ width: resolvedWidth }}
              initial={{ x: -24 }}
              animate={{ x: 0 }}
              exit={{ x: -24 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              onPointerDown={(event) => {
                if (isResizing) return;
                setSwipeStartX(event.clientX);
              }}
              onPointerMove={(event) => {
                if (swipeStartX === null) return;
                const deltaX = event.clientX - swipeStartX;
                if (deltaX <= -SWIPE_CLOSE_THRESHOLD) {
                  closeSidebar();
                  setSwipeStartX(null);
                }
              }}
              onPointerUp={(event) => {
                if (swipeStartX === null) return;
                const deltaX = event.clientX - swipeStartX;
                if (deltaX <= -SWIPE_CLOSE_THRESHOLD) {
                  closeSidebar();
                }
                setSwipeStartX(null);
              }}
              onPointerCancel={() => setSwipeStartX(null)}
            >
              {/* Title-bar overlay: keeps the window draggable and clears the traffic lights */}
              <div
                data-tauri-drag-region
                className="absolute inset-x-0 top-0 h-7"
                aria-hidden
              />
              {/* Nav items — compact, non-scrolling */}
              <div className="flex shrink-0 flex-col gap-2">
                <SidebarModeToggle
                  showLabel={showLabel}
                  sidebarMode={sidebarMode}
                  setSidebarMode={setSidebarMode}
                />
                <Reorder.Group
                  axis="y"
                  className="flex flex-col gap-0.5"
                  values={activeItems}
                  onReorder={
                    sidebarMode === "tasks"
                      ? setTaskItems
                      : sidebarMode === "social"
                        ? setSocialItems
                        : setAppItems
                  }
                >
                  {activeItems.map((item) => (
                    <Reorder.Item
                      key={`${sidebarMode}-${item.link}`}
                      value={item}
                      className="list-none"
                    >
                      <SidebarNavItemView
                        item={item}
                        showLabel={showLabel}
                        onOpenProfile={onOpenProfile}
                        onOpenSettings={onOpenSettings}
                      />
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </div>

              <div className="flex-1" />

              {/* Utility icon bar */}
              <div
                className={`flex shrink-0 items-center border-t pt-2 ${
                  isRail ? "flex-col gap-1" : "justify-around"
                } ${sidebarTokens.divider}`}
              >
                <button
                  type="button"
                  onClick={onOpenProfile}
                  aria-label="Profile"
                  title="Profile"
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${sidebarTokens.utilityButton}`}
                >
                  <IoPersonOutline className="text-base" />
                </button>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  aria-label="Settings"
                  title="Settings"
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${sidebarTokens.utilityButton}`}
                >
                  <IoSettingsOutline className="text-base" />
                </button>
                <NavLink
                  to="/help"
                  aria-label="Help"
                  title="Help"
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${sidebarTokens.utilityButton}`}
                >
                  <IoHelpCircleOutline className="text-base" />
                </NavLink>
                {canExpand ? (
                  <button
                    type="button"
                    onClick={() => setCompact((prev) => !prev)}
                    aria-label={compact ? "Show labels" : "Icons only"}
                    title={compact ? "Show labels" : "Icons only"}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${sidebarTokens.utilityButton}`}
                  >
                    {compact ? (
                      <IoChevronForward className="text-base" />
                    ) : (
                      <IoChevronBack className="text-base" />
                    )}
                  </button>
                ) : null}
              </div>
              {canExpand ? (
                <div
                  aria-label="Resize sidebar"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setIsResizing(true);
                  }}
                  className="absolute right-0 top-0 h-full w-3 translate-x-1/2 cursor-e-resize bg-transparent"
                />
              ) : null}
            </motion.nav>
          ) : (
            <motion.div
              key="sidebar-edge-swipe-zone"
              className="flex h-full items-center"
              initial={{ x: -12 }}
              animate={{ x: 0 }}
              exit={{ x: -12 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ width: EDGE_SWIPE_ZONE_WIDTH }}
              onPointerDown={(event) => {
                setEdgeSwipeStartX(event.clientX);
              }}
              onPointerMove={(event) => {
                if (edgeSwipeStartX === null) return;
                const deltaX = event.clientX - edgeSwipeStartX;
                if (deltaX >= EDGE_SWIPE_OPEN_THRESHOLD) {
                  openSidebar();
                  setEdgeSwipeStartX(null);
                }
              }}
              onPointerUp={(event) => {
                if (edgeSwipeStartX === null) return;
                const deltaX = event.clientX - edgeSwipeStartX;
                if (
                  deltaX >= EDGE_SWIPE_OPEN_THRESHOLD ||
                  Math.abs(deltaX) < 8
                ) {
                  openSidebar();
                }
                setEdgeSwipeStartX(null);
              }}
              onPointerCancel={() => setEdgeSwipeStartX(null)}
            >
              <button
                type="button"
                onClick={openSidebar}
                className="ml-1 inline-flex h-14 w-5 items-center justify-center rounded-r-full border border-line bg-surface text-muted shadow-sm backdrop-blur transition-colors hover:bg-sunken hover:text-ink"
                aria-label="Open sidebar"
                title="Open sidebar"
              >
                <IoChevronForward className="h-3.5 w-3.5" />
              </button>
              <span className="sr-only">
                Swipe right from the left edge to open sidebar
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default SideBar;
