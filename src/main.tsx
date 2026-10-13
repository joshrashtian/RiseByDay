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

// Before first paint, so the app never flashes light on a dark-mode launch.
applyTheme(readPersistedThemePreference());

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
