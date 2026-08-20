// Which sidebar view is currently visible. Lifted out of ReportShell's local
// state into a context so other views (e.g. ArchiveView and Intelligence) can
// navigate the user to a different view programmatically while preserving the
// exact evidence target that motivated the jump.
import { createContext, useContext, useState, type ReactNode } from "react";

export interface ViewNavigationTarget {
  source: "intelligence" | "archive" | "overview" | "other";
  targetView: string;
  fightIndex?: number;
  account?: string;
  timestampMs?: number;
  eventId?: string;
  metric?: string;
}

interface ViewContextValue {
  activeView: string;
  setActiveView: (view: string) => void;
  previousView: string | null;
  navigationTarget: ViewNavigationTarget | null;
  navigateToView: (view: string, target?: Omit<ViewNavigationTarget, "targetView">) => void;
  goBackToPreviousView: () => void;
  clearNavigationTarget: () => void;
}

const ViewContext = createContext<ViewContextValue>({
  activeView: "overview",
  setActiveView: () => {},
  previousView: null,
  navigationTarget: null,
  navigateToView: () => {},
  goBackToPreviousView: () => {},
  clearNavigationTarget: () => {},
});

const VIEW_LABELS: Record<string, string> = {
  overview: "Overview",
  kdr: "KDR",
  "fight-breakdown": "Fight Breakdown",
  "top-players": "Top Players",
  "top-skills": "Top Skills",
  offensive: "Offensive Stats",
  defensive: "Defensive Stats",
  "squad-stats": "Squad Stats",
  "player-profiles": "Player Profiles",
  "fight-replay": "Fight Replay",
  mechanics: "Mechanics Timeline",
  "death-recap": "Death Recap",
  intelligence: "Intelligence",
};

function viewLabel(view: string) {
  return VIEW_LABELS[view] ?? view.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ViewProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveViewState] = useState("overview");
  const [previousView, setPreviousView] = useState<string | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<ViewNavigationTarget | null>(null);

  function moveToView(view: string, target: ViewNavigationTarget | null) {
    if (view === activeView) {
      setNavigationTarget(target);
      return;
    }

    setPreviousView(activeView);
    setNavigationTarget(target);
    setActiveViewState(view);
  }

  function setActiveView(view: string) {
    moveToView(view, null);
  }

  function navigateToView(view: string, target?: Omit<ViewNavigationTarget, "targetView">) {
    moveToView(view, target ? { ...target, targetView: view } : null);
  }

  function goBackToPreviousView() {
    if (!previousView || previousView === activeView) return;
    const destination = previousView;
    setPreviousView(activeView);
    setNavigationTarget(null);
    setActiveViewState(destination);
  }

  function clearNavigationTarget() {
    setNavigationTarget(null);
  }

  const showTrail = !!previousView && !!navigationTarget && navigationTarget.targetView === activeView;
  const contextBits = showTrail
    ? [
        navigationTarget.metric,
        navigationTarget.account,
        typeof navigationTarget.fightIndex === "number" ? `Fight ${navigationTarget.fightIndex + 1}` : undefined,
      ].filter((value): value is string => !!value)
    : [];

  return (
    <ViewContext.Provider
      value={{
        activeView,
        setActiveView,
        previousView,
        navigationTarget,
        navigateToView,
        goBackToPreviousView,
        clearNavigationTarget,
      }}
    >
      {children}
      {showTrail && (
        <div className="theme-cross-view-trail" role="status" aria-live="polite">
          <button type="button" className="theme-cross-view-return" onClick={goBackToPreviousView}>
            <span aria-hidden="true">←</span>
            <span>Return to {viewLabel(previousView)}</span>
          </button>
          <div className="theme-cross-view-context">
            <span className="theme-cross-view-origin">From {viewLabel(previousView)}</span>
            {contextBits.length > 0 && <span className="theme-cross-view-separator" aria-hidden="true">·</span>}
            {contextBits.map((bit) => (
              <span key={bit} className="theme-cross-view-bit">{bit}</span>
            ))}
          </div>
        </div>
      )}
    </ViewContext.Provider>
  );
}

export function useView() {
  return useContext(ViewContext);
}
