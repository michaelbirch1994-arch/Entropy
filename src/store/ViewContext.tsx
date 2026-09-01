// Which sidebar view is currently visible. Lifted out of ReportShell's local
// state into a context so other views (e.g. ArchiveView and Intelligence) can
// navigate the user to a different view programmatically while preserving the
// exact evidence target that motivated the jump.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { parseAxiForgeShareQuery } from "../lib/axiforge/axiForgeShareLink";
import { viewLabel } from "../lib/viewRegistry";
import { buildViewUrl, normalizeViewId, parseViewUrlState } from "./viewUrlState";

export interface ViewNavigationTarget {
  source: "intelligence" | "archive" | "overview" | "other";
  targetView: string;
  /** Stable report fight identity. Prefer this over an array index when available. */
  fightId?: string;
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
  const [activeView, setActiveViewState] = useState(() => {
    if (typeof window === "undefined") return "overview";
    if (parseAxiForgeShareQuery(window.location.search)) return "axiforge-lab";
    return parseViewUrlState(window.location.search).view;
  });
  const [previousView, setPreviousView] = useState<string | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<ViewNavigationTarget | null>(() => {
    if (typeof window === "undefined" || parseAxiForgeShareQuery(window.location.search)) return null;
    return parseViewUrlState(window.location.search).navigationTarget;
  });
  const [navigationTrailTarget, setNavigationTrailTarget] = useState<ViewNavigationTarget | null>(() => {
    if (typeof window === "undefined" || parseAxiForgeShareQuery(window.location.search)) return null;
    return parseViewUrlState(window.location.search).navigationTarget;
  });
  const activeViewRef = useRef(activeView);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPopState = () => {
      if (parseAxiForgeShareQuery(window.location.search)) {
        setPreviousView(activeViewRef.current === "axiforge-lab" ? null : activeViewRef.current);
        setNavigationTarget(null);
        setNavigationTrailTarget(null);
        setActiveViewState("axiforge-lab");
        return;
      }

      const parsed = parseViewUrlState(window.location.search);
      setPreviousView(parsed.view === activeViewRef.current ? previousView : activeViewRef.current);
      setNavigationTarget(parsed.navigationTarget);
      setNavigationTrailTarget(parsed.navigationTarget);
      setActiveViewState(parsed.view);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [previousView]);

  function moveToView(view: string, target: ViewNavigationTarget | null) {
    const normalizedView = normalizeViewId(view);
    if (typeof window !== "undefined") {
      const nextUrl = buildViewUrl(window.location.href, normalizedView, target);
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextUrl !== currentUrl) window.history.pushState(null, "", nextUrl);
    }

    if (normalizedView === activeView) {
      setNavigationTarget(target);
      setNavigationTrailTarget(target);
      return;
    }

    setPreviousView(activeView);
    setNavigationTarget(target);
    setNavigationTrailTarget(target);
    setActiveViewState(normalizedView);
  }

  function setActiveView(view: string) {
    moveToView(view, null);
  }

  function navigateToView(view: string, target?: Omit<ViewNavigationTarget, "targetView">) {
    const normalizedView = normalizeViewId(view);
    moveToView(normalizedView, target ? { ...target, targetView: normalizedView } : null);
  }

  function goBackToPreviousView() {
    if (!previousView || previousView === activeView) return;
    const destination = normalizeViewId(previousView);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", buildViewUrl(window.location.href, destination, null));
    }
    setPreviousView(activeView);
    setNavigationTarget(null);
    setNavigationTrailTarget(null);
    setActiveViewState(destination);
  }

  function clearNavigationTarget() {
    setNavigationTarget(null);
  }

  // A destination may consume its one-shot navigation request immediately, but
  // the return trail must remain available until the user leaves or returns.
  const showTrail = !!previousView && !!navigationTrailTarget && navigationTrailTarget.targetView === activeView;
  const contextBits = showTrail
    ? [
        navigationTrailTarget.metric,
        navigationTrailTarget.account,
        typeof navigationTrailTarget.fightIndex === "number" ? `Fight ${navigationTrailTarget.fightIndex + 1}` : undefined,
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
