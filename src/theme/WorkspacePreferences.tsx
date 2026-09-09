import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";

export type WorkspacePreferences = {
  density: "comfortable" | "compact";
  motion: "system" | "reduced";
  contrast: "standard" | "high";
  sidebar: "expanded" | "compact";
};

const STORAGE_KEY = "entropy.workspace.appearance.v1";
export const DEFAULT_PREFERENCES: WorkspacePreferences = {
  density: "comfortable", motion: "system", contrast: "standard", sidebar: "expanded",
};

export function parseWorkspacePreferences(value: unknown): WorkspacePreferences {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    density: data.density === "compact" ? "compact" : "comfortable",
    motion: data.motion === "reduced" ? "reduced" : "system",
    contrast: data.contrast === "high" ? "high" : "standard",
    sidebar: data.sidebar === "compact" ? "compact" : "expanded",
  };
}

const Context = createContext<{
  preferences: WorkspacePreferences;
  updatePreference: <K extends keyof WorkspacePreferences>(key: K, value: WorkspacePreferences[K]) => void;
}>({ preferences: DEFAULT_PREFERENCES, updatePreference: () => {} });

export function WorkspacePreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<WorkspacePreferences>(() => {
    try { return parseWorkspacePreferences(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")); }
    catch { return DEFAULT_PREFERENCES; }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.density = preferences.density;
    root.dataset.motion = preferences.motion;
    root.dataset.contrast = preferences.contrast;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch { /* Session-only when storage is unavailable. */ }
  }, [preferences]);

  const updatePreference = useCallback(<K extends keyof WorkspacePreferences>(key: K, value: WorkspacePreferences[K]) => {
    setPreferences((current) => current[key] === value ? current : { ...current, [key]: value });
  }, []);
  const contextValue = useMemo(() => ({ preferences, updatePreference }), [preferences, updatePreference]);

  return (
    <Context.Provider value={contextValue}>
      <MotionConfig reducedMotion={preferences.motion === "reduced" ? "always" : "user"}>
        {children}
      </MotionConfig>
    </Context.Provider>
  );
}

export const useWorkspacePreferences = () => useContext(Context);
