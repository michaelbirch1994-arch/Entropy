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
    </ViewContext.Provider>
  );
}

export function useView() {
  return useContext(ViewContext);
}
