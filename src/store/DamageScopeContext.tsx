import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { Crosshair, Globe2 } from "lucide-react";

// Sitewide toggle for whether damage/DPS-derived stats show player-vs-player
// totals only ("Players" - matches dps.report's "Target" column and TopStats)
// or every hit including siege/NPCs/gates/dolyaks ("All" - EI's raw "All"
// column). Only damage/DPS/Top Skills have this split in the underlying EI
// data - healing, barrier, and strips are always player-vs-player already.
// Persisted so the choice survives reloads within a session.

export type DamageScope = "players" | "all";

const STORAGE_KEY = "entropy-damage-scope";

const DamageScopeContext = createContext<{
  scope: DamageScope;
  setScope: (scope: DamageScope) => void;
} | null>(null);

const readInitialScope = (): DamageScope => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "all" ? "all" : "players";
  } catch {
    return "players";
  }
};

export function DamageScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setScopeState] = useState<DamageScope>(readInitialScope);

  const setScope = useCallback((next: DamageScope) => {
    setScopeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore (private browsing / storage disabled)
    }
  }, []);

  const value = useMemo(() => ({ scope, setScope }), [scope, setScope]);

  return <DamageScopeContext.Provider value={value}>{children}</DamageScopeContext.Provider>;
}

export function useDamageScope() {
  const ctx = useContext(DamageScopeContext);
  if (!ctx) throw new Error("useDamageScope must be used within a DamageScopeProvider");
  return ctx;
}

// Reads whichever of a "players" / "all" field pair matches the current
// scope, falling back to the players-only value if the "all" field is
// missing (e.g. older cached reports built before this split existed).
export function pickDamageScopeValue(
  scope: DamageScope,
  playersValue: number | undefined,
  allValue: number | undefined
): number {
  if (scope === "all" && typeof allValue === "number") return allValue;
  return playersValue ?? 0;
}

export function DamageScopeToggle({ className = "" }: { className?: string }) {
  const { scope, setScope } = useDamageScope();
  const isAll = scope === "all";
  return (
    <button
      type="button"
      onClick={() => setScope(isAll ? "players" : "all")}
      title={
        isAll
          ? "Showing damage/DPS against everything (players, siege, NPCs, gates). Click to show players only."
          : "Showing damage/DPS against players only, matching dps.report/TopStats. Click to include siege/NPCs/gates."
      }
      className={`theme-filter-button flex items-center gap-1.5 rounded-lg border border-theme-border bg-theme-surface px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-theme-muted transition-colors hover:border-theme-accent/30 hover:bg-theme-surface-elevated hover:text-theme-text ${className}`}
      data-active="true"
    >
      <span className="text-theme-accent-strong">
        {isAll ? <Globe2 className="w-3 h-3" /> : <Crosshair className="w-3 h-3" />}
      </span>
      {isAll ? "All Damage" : "Players Only"}
    </button>
  );
}
