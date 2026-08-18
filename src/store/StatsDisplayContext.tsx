import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { Hash, Timer } from "lucide-react";

// Sitewide toggle for whether summary stat cards show a fight total or a
// per-second rate. Per-second is computed as total / (combined active
// seconds across the players behind that total), so it reads as "how fast
// was this being generated" rather than "how much accumulated" - useful for
// comparing squads/fights of very different lengths.

export type StatsDisplayMode = "total" | "perSecond";

const STORAGE_KEY = "entropy-stats-display-mode";

const StatsDisplayContext = createContext<{
  mode: StatsDisplayMode;
  setMode: (mode: StatsDisplayMode) => void;
} | null>(null);

const readInitialMode = (): StatsDisplayMode => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "perSecond" ? "perSecond" : "total";
  } catch {
    return "total";
  }
};

export function StatsDisplayProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<StatsDisplayMode>(readInitialMode);

  const setMode = useCallback((next: StatsDisplayMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return <StatsDisplayContext.Provider value={value}>{children}</StatsDisplayContext.Provider>;
}

export function useStatsDisplay() {
  const ctx = useContext(StatsDisplayContext);
  if (!ctx) throw new Error("useStatsDisplay must be used within a StatsDisplayProvider");
  return ctx;
}

// total: raw sum. activeSeconds: combined active time (seconds) across the
// players behind that total - pass 0 to fall back to the raw total (avoids
// divide-by-zero when duration data isn't available for a given stat yet).
export function pickStatsDisplayValue(mode: StatsDisplayMode, total: number, activeSeconds: number): number {
  if (mode === "perSecond" && activeSeconds > 0) return total / activeSeconds;
  return total;
}

export function StatsDisplayToggle({ className = "" }: { className?: string }) {
  const { mode, setMode } = useStatsDisplay();
  const isPerSecond = mode === "perSecond";
  return (
    <button
      type="button"
      onClick={() => setMode(isPerSecond ? "total" : "perSecond")}
      title={isPerSecond ? "Showing per-second rates. Click to show fight totals." : "Showing fight totals. Click to show per-second rates."}
      className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition-colors ${
        isPerSecond
          ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
          : "text-slate-400 border-slate-600/30 bg-slate-500/5 hover:bg-slate-500/10"
      } ${className}`}
    >
      {isPerSecond ? <Timer className="w-3 h-3" /> : <Hash className="w-3 h-3" />}
      {isPerSecond ? "Per Second" : "Totals"}
    </button>
  );
}
