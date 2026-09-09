import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./theme/ThemeProvider";
import { WorkspacePreferencesProvider } from "./theme/WorkspacePreferences";
import "./Styles/Global.css";
import "./Styles/Ultrawide.css";
import "./Styles/UXPolish.css";
import "./Styles/AnalyticsSurfaces.css";
import "./Styles/NavigationShell.css";
import "./Styles/ReplayWorkspace.css";
import "./Styles/MotionPolish.css";
import "./Styles/CrossViewTrail.css";
import "./Styles/IntelligencePulse.css";
import "./Styles/GrandLanding.css";
import "./Styles/BuilderSquadUsability.css";
import "./Styles/ProductEnrichment.css";
import "./Styles/BuilderVisualFoundation.css";
// One application finish, after domain layout styles.
import "./Styles/ObsidianGold.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <WorkspacePreferencesProvider><App /></WorkspacePreferencesProvider>
    </ThemeProvider>
  </StrictMode>
);
