import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_THEME, getThemePreset, type ThemePreset, type ThemeSlug } from "./themePresets";
import { loadSavedTheme, saveTheme } from "./themeStorage";

interface ThemeContextValue {
  activeTheme: ThemePreset;
  activeThemeSlug: ThemeSlug;
  setTheme: (theme: ThemeSlug) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: ThemePreset) {
  const root = document.documentElement;
  const body = document.body;
  root.dataset.theme = theme.slug;
  body.dataset.theme = theme.slug;

  root.style.setProperty("--theme-display-font", theme.typography.display);
  root.style.setProperty("--theme-body-font", theme.typography.body);
  root.style.setProperty("--theme-mono-font", theme.typography.mono);

  for (const [token, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--theme-${token}`, value);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [activeThemeSlug, setActiveThemeSlug] = useState<ThemeSlug>(DEFAULT_THEME);
  const [loadedSavedTheme, setLoadedSavedTheme] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadSavedTheme().then((savedTheme) => {
      if (!cancelled) {
        setActiveThemeSlug(savedTheme);
        setLoadedSavedTheme(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeTheme = useMemo(() => getThemePreset(activeThemeSlug), [activeThemeSlug]);

  useEffect(() => {
    applyTheme(activeTheme);
    if (loadedSavedTheme) void saveTheme(activeTheme.slug);
  }, [activeTheme, loadedSavedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      activeTheme,
      activeThemeSlug: activeTheme.slug,
      setTheme: setActiveThemeSlug,
    }),
    [activeTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
