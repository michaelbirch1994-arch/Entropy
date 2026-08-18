import { useEffect, type ReactNode } from "react";
import { ENTROPY_THEME } from "./defaultTheme";

function applyEntropyTheme() {
  const root = document.documentElement;

  root.style.setProperty("--theme-display-font", ENTROPY_THEME.typography.display);
  root.style.setProperty("--theme-body-font", ENTROPY_THEME.typography.body);
  root.style.setProperty("--theme-mono-font", ENTROPY_THEME.typography.mono);

  for (const [token, value] of Object.entries(ENTROPY_THEME.colors)) {
    root.style.setProperty(`--theme-${token}`, value);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyEntropyTheme();
  }, []);

  return <>{children}</>;
}
