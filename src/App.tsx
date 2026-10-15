import "./App.css";
import { useEffect, useState } from "react";
import {
  Navigate,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { motion } from "motion/react";
import { IoClose } from "react-icons/io5";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "./lib/tauriEnv";
import SignInScreen from "./screens/SignInScreen";
import CognitionWindowScreen from "./screens/CognitionWindowScreen";
import { AnimatedPage } from "./components/layout/AnimatedPage";
import SideBar from "./components/global/sidebar";
import { RightPanel } from "./components/global/rightpanel/RightPanel";
import { HomeScreen } from "./screens/HomeScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import TasksScreen from "./screens/TasksScreen";
import CalendarScreen from "./screens/CalendarScreen";
import AppsScreen from "./screens/AppsScreen";
import SpotifyScreen from "./screens/integrations/SpotifyScreen";
import { PROJECTS_ENABLED, SPOTIFY_ENABLED } from "./lib/featureFlags";
import ToolkitScreen from "./screens/ToolkitScreen";
import ToolkitWindowScreen from "./screens/ToolkitWindowScreen";
import PomodoroScreen from "./screens/pomodoro/PomodoroScreen";
import ProjectsScreen from "./screens/ProjectsScreen";
import CognitionBar from "./ui/CognitionBar";
import { TaskDragGhost } from "./components/global/TaskDragGhost";
import { TopBreadcrumbBar } from "./components/global/TopBreadcrumbBar";
import { PomodoroTicker } from "./components/global/PomodoroTicker";
import { PomodoroLinkedTaskSync } from "./components/global/PomodoroLinkedTaskSync";
import { TasksSyncEngine } from "./components/global/TasksSyncEngine";
import { useAppZoom } from "./hooks/useAppZoom";
import { useAppTheme } from "./hooks/useAppTheme";
import { useUserThemesSync } from "./hooks/useUserThemesSync";
import { useMenuNavigation } from "./hooks/useMenuNavigation";
import { useCreateTaskAction } from "./hooks/useCreateTaskAction";
import { useGoogleCalendarSync } from "./hooks/useGoogleCalendarSync";
import { useTaskNotifications } from "./hooks/useTaskNotifications";
import { useRightPanel } from "./providers/RightPanelProvider";
import SocialScreen from "./screens/social/SocialScreen";
import ProfileScreen from "./screens/social/ProfileScreen";
import SearchScreen from "./screens/social/SearchScreen";
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

const isSignInWindow = isTauri() && getCurrentWindow().label === "sign-in";
const isCognitionWindow =
  isTauri() && getCurrentWindow().label === "cognition";
// Lets App.css drop the opaque page background so the window can be see-through.
if (isCognitionWindow) document.documentElement.dataset.window = "cognition";

export default function App() {
  if (isSignInWindow) return <SignInScreen />;
  if (isCognitionWindow) return <CognitionWindowScreen />;

  const location = useLocation();
  const navigate = useNavigate();
  const { togglePanel } = useRightPanel();
  useMenuNavigation();
  useAppZoom();
  useAppTheme();
  useUserThemesSync();
  useCreateTaskAction();
  useGoogleCalendarSync();
  useTaskNotifications();
  const [sidebarOffset, setSidebarOffset] = useState(220);
  const [rightPanelOffset, setRightPanelOffset] = useState(0);
  // Unlike the offset, this is non-zero in overlay mode too.
  const [rightPanelCover, setRightPanelCover] = useState(0);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    const onOpenSettings = () => setShowSettingsModal(true);
    window.addEventListener("rbd:open-settings", onOpenSettings);
    return () =>
      window.removeEventListener("rbd:open-settings", onOpenSettings);
  }, []);

  useEffect(() => {
    if (location.pathname !== "/settings") return;
    setShowSettingsModal(true);
    navigate("/", { replace: true });
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (!import.meta.env.PROD) return; // skip in dev
    (async () => {
      try {
        const update = await check();
        if (update) {
          await update.downloadAndInstall();
          await relaunch();
        }
      } catch (e) {
        console.error('Update check failed', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!showSettingsModal) return;
    const onEscClose = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowSettingsModal(false);
      }
    };

    window.addEventListener("keydown", onEscClose);
    return () => window.removeEventListener("keydown", onEscClose);
  }, [showSettingsModal]);

  return (
    <div id="app-zoom-root" className="h-full w-full overflow-hidden">
      <SideBar
        onWidthChange={setSidebarOffset}
        onOpenProfile={togglePanel}
        onOpenSettings={() => setShowSettingsModal(true)}
      />
      <RightPanel
        onWidthChange={setRightPanelOffset}
        onCoverWidthChange={setRightPanelCover}
      />
      <motion.div
        className="relative flex h-full min-h-0 flex-col overflow-hidden transition-[padding] duration-200"
        style={{ paddingLeft: sidebarOffset, paddingRight: rightPanelOffset }}
      >
        {/* Title-bar overlay: the native bar is hidden, so this strip keeps the window draggable */}
        <div
          data-tauri-drag-region
          className="absolute inset-x-0 top-0 z-30 h-7"
          aria-hidden
        />
        <TopBreadcrumbBar left={sidebarOffset} right={rightPanelOffset} />
        <motion.div className="flex h-full min-h-0 flex-col overflow-hidden px-4 pb-4 pt-7 bg-sunken">
          <Routes location={location} key={location.pathname}>
            <Route path="/auth/sign-in" element={<SignInScreen />} />
            {SPOTIFY_ENABLED && (
              <Route
                path="/spotify"
                element={
                  <AnimatedPage>
                    <SpotifyScreen />
                  </AnimatedPage>
                }
              />
            )}
            <Route
              path="/"
              element={
                <AnimatedPage>
                  <HomeScreen />
                </AnimatedPage>
              }
            />
            <Route
              path="/tasks/*"
              element={
                <AnimatedPage>
                  <TasksScreen />
                </AnimatedPage>
              }
            />
            {PROJECTS_ENABLED && (
              <Route
                path="/projects/*"
                element={
                  <AnimatedPage>
                    <ProjectsScreen />
                  </AnimatedPage>
                }
              />
            )}
            <Route
              path="/calendar/*"
              element={
                <AnimatedPage>
                  <CalendarScreen />
                </AnimatedPage>
              }
            />
            {/* Blocks moved under the calendar; keep old links working. */}
            <Route
              path="/blocks"
              element={<Navigate to="/calendar/blocks" replace />}
            />
            <Route
              path="/pomodoro"
              element={
                <AnimatedPage>
                  <PomodoroScreen />
                </AnimatedPage>
              }
            />
            <Route
              path="/apps"
              element={
                <AnimatedPage>
                  <AppsScreen />
                </AnimatedPage>
              }
            />
            <Route
              path="/toolkit"
              element={
                <AnimatedPage>
                  <ToolkitScreen />
                </AnimatedPage>
              }
            />
            <Route
              path="/toolkit/:panelId"
              element={
                <AnimatedPage>
                  <ToolkitWindowScreen />
                </AnimatedPage>
              }
            />
            <Route
              path="/social/home"
              element={
                <AnimatedPage>
                  <SocialScreen />
                </AnimatedPage>
              }
            />
            <Route
              path="/social/search"
              element={
                <AnimatedPage>
                  <SearchScreen />
                </AnimatedPage>
              }
            />
            <Route
              path="/social/profile"
              element={
                <AnimatedPage>
                  <ProfileScreen />
                </AnimatedPage>
              }
            />
            <Route
              path="/social/profile/:userId"
              element={
                <AnimatedPage>
                  <ProfileScreen />
                </AnimatedPage>
              }
            />
          </Routes>
          {showSettingsModal ? (
            <div
              className="fixed inset-0 z-70 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
              onClick={() => setShowSettingsModal(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Settings"
                className="relative flex h-[min(90vh,920px)] w-full max-w-295 overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface/90 text-muted transition-colors hover:bg-sunken hover:text-ink"
                  aria-label="Close settings"
                >
                  <IoClose className="h-5 w-5" />
                </button>
                <div className="h-full w-full overflow-y-auto">
                  <SettingsScreen modal />
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>
        <CognitionBar
          left={sidebarOffset}
          right={rightPanelOffset}
          belowOverlay={rightPanelCover > 0 && rightPanelOffset === 0}
        />
        <PomodoroTicker />
        <PomodoroLinkedTaskSync />
        <TasksSyncEngine />
        <TaskDragGhost />
      </motion.div>
    </div>
  );
}
