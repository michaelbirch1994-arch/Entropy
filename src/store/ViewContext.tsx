// Which sidebar view is currently visible. Lifted out of ReportShell's local
// state into a context so other views (e.g. ArchiveView and Intelligence) can
// navigate the user to a different view programmatically while preserving the
// exact evidence target that motivated the jump.
import { createContext, useContext, useState, type ReactNode } from "react";

export interface ViewNavigationTarget {
  source: "intelligence" | "archive" | "other";
  targetView: string;
  fightIndex?: number;
  account?: string;
  timestampMs?: number;
  eventId?: string;
}

interface ViewContextValue {
  activeView: string;
  setActiveView: (view: string) => void;
  navigationTarget: ViewNavigationTarget | null;
  navigateToView: (view: string, target?: Omit<ViewNavigationTarget, "targetView">) => void;
  clearNavigationTarget: () => void;
}

const ViewContext = createContext<ViewContextValue>({
  activeView: "overview",
  setActiveView: () => {},
  navigationTarget: null,
  navigateToView: () => {},
  clearNavigationTarget: () => {},
});

export function ViewProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState("overview");
  const [navigationTarget, setNavigationTarget] = useState<ViewNavigationTarget | null>(null);

  function navigateToView(view: string, target?: Omit<ViewNavigationTarget, "targetView">) {
    setNavigationTarget(target ? { ...target, targetView: view } : null);
    setActiveView(view);
  }

  function clearNavigationTarget() {
    setNavigationTarget(null);
  }

  return (
    <ViewContext.Provider
      value={{ activeView, setActiveView, navigationTarget, navigateToView, clearNavigationTarget }}
    >
      {children}
    </ViewContext.Provider>
  );
}

export function useView() {
  return useContext(ViewContext);
}
