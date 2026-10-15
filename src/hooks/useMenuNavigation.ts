import { useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import {
  APP_ZOOM_DEFAULT,
  APP_ZOOM_STEP,
  applyAppZoomToDocument,
  clampAppZoom,
} from "../lib/appZoom";
import { useSettingsStore } from "../stores/settingsStore";
import { openDocs } from "../lib/docs";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function useMenuNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    let unlistenNavigate: (() => void) | undefined;
    let unlistenZoom: (() => void) | undefined;
    let zoomLevel = clampAppZoom(useSettingsStore.getState().zoomLevel);

    const applyZoom = (value: number) => {
      zoomLevel = clampAppZoom(value);
      useSettingsStore.getState().setZoomLevel(zoomLevel);
      applyAppZoomToDocument(zoomLevel);
    };

    applyZoom(zoomLevel);

    const onWheel = (event: WheelEvent) => {
      // macOS trackpad pinch → ctrl+wheel (same as Chrome/Safari).
      if (!event.ctrlKey) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      const direction = event.deltaY > 0 ? -1 : 1;
      applyZoom(zoomLevel + direction * APP_ZOOM_STEP);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (isEditableTarget(event.target)) return;

      if (event.key === "=" || event.key === "+") {
        event.preventDefault();
        applyZoom(zoomLevel + APP_ZOOM_STEP);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        applyZoom(zoomLevel - APP_ZOOM_STEP);
      } else if (event.key === "0") {
        event.preventDefault();
        applyZoom(APP_ZOOM_DEFAULT);
      }
    };

    listen<string>("navigate", (event) => {
      switch (event.payload) {
        case "home":
          navigate("/");
          break;
        case "tasks":
          navigate("/tasks");
          break;
        case "calendar":
          navigate("/calendar");
          break;
        case "blocks":
          navigate("/calendar/blocks");
          break;
        case "pomodoro":
          navigate("/pomodoro");
          break;
        case "profile":
          window.dispatchEvent(new Event("rbd:open-profile"));
          break;
        case "settings":
          window.dispatchEvent(new Event("rbd:open-settings"));
          break;
        case "help":
          openDocs();
          break;
        case "toolkit":
          navigate("/toolkit");
          break;
      }
    }).then((fn) => {
      unlistenNavigate = fn;
    });

    listen<string>("menu-zoom", (event) => {
      switch (event.payload) {
        case "in":
          applyZoom(zoomLevel + APP_ZOOM_STEP);
          break;
        case "out":
          applyZoom(zoomLevel - APP_ZOOM_STEP);
          break;
        case "reset":
          applyZoom(APP_ZOOM_DEFAULT);
          break;
      }
    }).then((fn) => {
      unlistenZoom = fn;
    });

    window.addEventListener("wheel", onWheel, { passive: false });

    const isTauri =
      typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (!isTauri) {
      window.addEventListener("keydown", onKeyDown);
    }

    return () => {
      unlistenNavigate?.();
      unlistenZoom?.();
      window.removeEventListener("wheel", onWheel);
      if (!isTauri) {
        window.removeEventListener("keydown", onKeyDown);
      }
    };
  }, [navigate]);
}
