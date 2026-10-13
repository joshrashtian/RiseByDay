import { useAnimation, useReducedMotionConfig } from "motion/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls } from "motion/react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export type SnapPoint = "peek" | "half" | "full";

export const SNAP_POINT_ORDER: readonly SnapPoint[] = ["peek", "half", "full"];

const SNAP_MAX_HEIGHT: Record<SnapPoint, string> = {
  peek: "min(58dvh, 480px)",
  half: "min(72dvh, 620px)",
  full: "min(92dvh, 800px)",
};

const SNAP_MAX_HEIGHT_FULL_WIDTH: Record<SnapPoint, string> = {
  peek: "min(62dvh, 520px)",
  half: "min(78dvh, 680px)",
  full: "min(96dvh, 920px)",
};

function getEnabledSnapPoints(snapPoints: readonly SnapPoint[]): SnapPoint[] {
  const filtered = SNAP_POINT_ORDER.filter((p) => snapPoints.includes(p));
  return filtered.length > 0 ? filtered : [...SNAP_POINT_ORDER];
}

export type BottomSheetWidth = "default" | "wide" | "full";

const WIDTH_CLASS: Record<BottomSheetWidth, { wrapper: string; panel: string }> =
  {
    default: {
      wrapper: "px-4",
      panel: "max-w-2xl rounded-t-2xl",
    },
    wide: {
      wrapper: "px-4 sm:px-6",
      panel: "max-w-5xl rounded-t-2xl",
    },
    full: {
      wrapper: "px-0",
      panel: "max-w-none rounded-none border-x-0",
    },
  };

function normalizeSnapForEnabled(
  snap: SnapPoint,
  enabled: readonly SnapPoint[],
): SnapPoint {
  if (enabled.includes(snap)) return snap;
  return enabled[0] ?? "peek";
}

export type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  titleClassName?: string;
  titleIcon?: ReactNode;
  headerActions?: ReactNode;
  width?: BottomSheetWidth;
  snapPoints?: readonly SnapPoint[];
  defaultSnap?: SnapPoint;
  onSnapChange?: (snap: SnapPoint) => void;
  children?: ReactNode;
};

const SPRING = { type: "spring", stiffness: 380, damping: 34 } as const;
// CSS transition used for height/max-height snap changes; Motion handles y separately.
const HEIGHT_TRANSITION =
  "height 340ms cubic-bezier(0.32,0.72,0,1), max-height 340ms cubic-bezier(0.32,0.72,0,1)";

export default function BottomSheet({
  open,
  onClose,
  title,
  titleClassName,
  titleIcon,
  headerActions,
  width = "default",
  snapPoints = SNAP_POINT_ORDER,
  defaultSnap = "peek",
  onSnapChange,
  children,
}: BottomSheetProps) {
  const snapPointsKey = [...snapPoints].sort().join();
  const stableEnabled = useMemo(
    () => getEnabledSnapPoints(snapPoints),
    [snapPointsKey],
  );

  const [snap, setSnap] = useState<SnapPoint>(() =>
    normalizeSnapForEnabled(defaultSnap, getEnabledSnapPoints(snapPoints)),
  );

  const dragControls = useDragControls();
  // Controls only the drag-layer's y — lets us reset to 0 after every release.
  const dragY = useAnimation();
  const reduceMotion = useReducedMotionConfig();

  const panelRef = useRef<HTMLDivElement>(null);
  // The element that had focus before the sheet opened, to restore on close.
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      setSnap(normalizeSnapForEnabled(defaultSnap, stableEnabled));
    }
  }, [open, defaultSnap, stableEnabled]);

  // Focus management: move focus into the dialog on open, restore it on close.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    // Defer until the panel is mounted/animated in.
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? panel).focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      restoreFocusRef.current?.focus?.();
      restoreFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Trap Tab focus within the panel.
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = Array.from(
          panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (focusable.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === panel)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function cycleSnap() {
    const i = stableEnabled.indexOf(snap);
    const idx = i < 0 ? 0 : i;
    const next = stableEnabled[(idx + 1) % stableEnabled.length] ?? snap;
    setSnap(next);
    onSnapChange?.(next);
  }

  // Spring for gestures, near-instant when the user prefers reduced motion.
  const motionTransition = reduceMotion ? { duration: 0 } : SPRING;
  const heightTransition = reduceMotion ? "none" : HEIGHT_TRANSITION;

  function resetDragY() {
    dragY.start({ y: 0, transition: motionTransition });
  }

  function handleDragEnd(
    _: unknown,
    info: { offset: { y: number }; velocity: { y: number } },
  ) {
    const { offset, velocity } = info;

    if (velocity.y > 500) {
      onClose();
      return;
    }

    const idx = stableEnabled.indexOf(snap);

    if (idx >= 0) {
      // Strong upward flick → next higher snap.
      if (velocity.y < -520 && idx < stableEnabled.length - 1) {
        const next = stableEnabled[idx + 1]!;
        setSnap(next);
        onSnapChange?.(next);
      } else if (offset.y > 72) {
        // Drag down: lower snap or dismiss from peek.
        if (idx === 0) {
          if (offset.y > 110) { onClose(); return; }
        } else {
          const next = stableEnabled[idx - 1]!;
          setSnap(next);
          onSnapChange?.(next);
        }
      } else if (-offset.y > 56 && idx < stableEnabled.length - 1) {
        // Drag up: higher snap.
        const next = stableEnabled[idx + 1]!;
        setSnap(next);
        onSnapChange?.(next);
      }
    }

    // Always spring drag-layer back to y: 0 so it never stays displaced.
    resetDragY();
  }

  if (typeof document === "undefined") return null;

  const maxHeight =
    width === "full" ? SNAP_MAX_HEIGHT_FULL_WIDTH[snap] : SNAP_MAX_HEIGHT[snap];
  const widthClasses = WIDTH_CLASS[width];

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="bottom-sheet-root"
          className="fixed inset-0 z-65"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* backdrop — decorative; the "Done" button is the labelled close affordance */}
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-overlay backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Slide wrapper — absolute to bottom, full width, centered.
              Only responsible for the enter/exit slide; no drag here. */}
          <motion.div
            className={`absolute bottom-0 left-0 right-0 z-10 flex justify-center ${widthClasses.wrapper}`}
            initial={reduceMotion ? { opacity: 0 } : { y: "110dvh" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "110dvh" }}
            transition={motionTransition}
          >
            {/* Drag layer — resets to y:0 after every gesture via dragY controls.
                Height changes via CSS transition so Motion y is never entangled. */}
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? "bottom-sheet-title" : undefined}
              tabIndex={-1}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: -220, bottom: 220 }}
              dragElastic={{ top: 0.12, bottom: 0.22 }}
              dragMomentum={false}
              onDragEnd={handleDragEnd}
              animate={dragY}
              className={`flex min-h-0 w-full flex-col overflow-hidden border border-line/80 bg-surface shadow-[0_-12px_40px_rgba(0,0,0,0.12)] outline-none dark:shadow-[0_-12px_40px_rgba(0,0,0,0.45)] ${widthClasses.panel}`}
              style={{ height: maxHeight, maxHeight, transition: heightTransition }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* drag handle */}
              <div
                className="flex shrink-0 cursor-grab justify-center pb-1 pt-2 active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <span
                  className="h-1 w-10 rounded-full bg-zinc-300"
                  aria-hidden
                />
              </div>

              {/* header */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 pb-3 pt-1 sm:px-6">
                {title ? (
                  <h2
                    id="bottom-sheet-title"
                    className={`flex flex-row items-center gap-2 -skew-x-3 text-lg font-semibold text-ink ${titleClassName ?? ""}`}
                  >
                    {titleIcon}
                    {title}
                  </h2>
                ) : (
                  <span className="text-sm text-muted">
                    Bottom sheet
                  </span>
                )}

                <div className="flex items-center gap-1">
                  {headerActions}
                  {/* snap cycle */}
                  <button
                    type="button"
                    onClick={cycleSnap}
                    aria-label={
                      stableEnabled.length < 2
                        ? "Snap height"
                        : snap === stableEnabled[stableEnabled.length - 1]
                          ? "Use shorter snap"
                          : "Use taller snap"
                    }
                    className="rounded-lg p-1.5 text-faint transition-colors hover:bg-sunken hover:text-muted"
                  >
                    {snap === stableEnabled[stableEnabled.length - 1] ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M2.5 5l4.5 4.5L11.5 5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M2.5 9l4.5-4.5L11.5 9"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>

                  {/* done / close */}
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg px-2 py-1 text-sm font-medium text-muted hover:bg-sunken"
                  >
                    Done
                  </button>
                </div>
              </div>

              {/* content */}
              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 text-sm text-muted sm:px-6"
                style={{
                  paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
                }}
              >
                {children ?? (
                  <p className="leading-relaxed">
                    Pass{" "}
                    <code className="rounded bg-sunken px-1 py-0.5 font-mono text-[13px]">
                      children
                    </code>{" "}
                    for content. Drag the handle, tap the backdrop, or press
                    Escape to close.
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
