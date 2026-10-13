import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import ContextMenuProvider from "./providers/ContextMenuProvider";
import PopupProvider from "./providers/PopupProvider";
import { DayTransitionProvider } from "./providers/DayTransitionProvider";
import { ProfileProvider } from "./providers/ProfileProvider";
import { RightPanelProvider } from "./providers/RightPanelProvider";
import GuideProvider from "./providers/GlobalHelpProvider";
import { MotionPreferenceProvider } from "./providers/MotionPreferenceProvider";
import { applyTheme, readPersistedThemePreference } from "./lib/appTheme";
import { applyColorTheme, readPersistedColorTheme } from "./lib/colorThemes";

// Before first paint, so the app never flashes light on a dark-mode launch.
// The color theme must be applied here too: App.css holds no token values.
applyTheme(readPersistedThemePreference());
const persistedColorTheme = readPersistedColorTheme();
applyColorTheme(persistedColorTheme.id, persistedColorTheme.customThemes);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <HashRouter>
      <MotionPreferenceProvider>
        <GuideProvider>
          <ContextMenuProvider>
            <PopupProvider>
              <DayTransitionProvider>
                <ProfileProvider>
                  <RightPanelProvider>
                    <App />
                  </RightPanelProvider>
                </ProfileProvider>
              </DayTransitionProvider>
            </PopupProvider>
          </ContextMenuProvider>
        </GuideProvider>
      </MotionPreferenceProvider>
    </HashRouter>
  </React.StrictMode>,
);
