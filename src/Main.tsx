import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./theme/ThemeProvider";
import "./Styles/Global.css";
import "./Styles/Ultrawide.css";
import "./Styles/UXPolish.css";
import "./Styles/AnalyticsSurfaces.css";
import "./Styles/NavigationShell.css";
import "./Styles/ReplayWorkspace.css";
import "./Styles/MotionPolish.css";
import "./Styles/CrossViewTrail.css";
import "./Styles/IntelligencePulse.css";
import "./Styles/ObsidianGold.css";
import "./Styles/BlackGoldFinish.css";
import "./Styles/BlackGoldRefinement.css";
import "./Styles/RoyalPolish.css";
import "./Styles/ObsidianGoldPass8.css";
import "./Styles/GrandLanding.css";
import "./Styles/BuilderSquadUsability.css";
import "./Styles/ProductEnrichment.css";
import "./Styles/BuilderVisualFoundation.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);
