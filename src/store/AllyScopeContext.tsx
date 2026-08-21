import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { Users, UsersRound } from "lucide-react";

// Sitewide toggle for whether ally-facing totals (healing, barrier) count
// squad members only or every tracked ally (squad + non-squad allies in the
// same fights). EI/dps.report already split these out per player
// (healingTotals.squadHealing/squadBarrier vs the all-allies
// healing/barrier totals) - this just controls which of that existing pair
// the summary cards read.

export type AllyScope = "squad" | "all";

const STORAGE_KEY = "entropy-ally-scope";

const AllyScopeContext = createContext<{
  scope: AllyScope;
  setScope: (scope: AllyScope) => void;
} | null>(null);

const readInitialScope = (): AllyScope => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "all" ? "all" : "squad";
  } catch {
    return "squad";
  }
};

export function AllyScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setScopeState] = useState<AllyScope>(readInitialScope);

  const setScope = useCallback((next: AllyScope) => {
    setScopeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(() => ({ scope, setScope }), [scope, setScope]);

  return <AllyScopeContext.Provider value={value}>{children}</AllyScopeContext.Provider>;
}

export function useAllyScope() {
  const ctx = useContext(AllyScopeContext);
  if (!ctx) throw new Error("useAllyScope must be used within an AllyScopeProvider");
  return ctx;
}

export function pickAllyScopeValue(scope: AllyScope, allValue: number | undefined, squadValue: number | undefined): number {
  if (scope === "squad" && typeof squadValue === "number") return squadValue;
  return allValue ?? 0;
}

export function AllyScopeToggle({ className = "" }: { className?: string }) {
  const { scope, setScope } = useAllyScope();
  const isSquad = scope === "squad";
  return (
    <button
      type="button"
      onClick={() => setScope(isSquad ? "all" : "squad")}
      title={
        isSquad
          ? "Counting healing/barrier given to squad members only. Click to include off-squad allies too."
          : "Counting healing/barrier given to all allies (squad + off-squad). Click to count squad only."
      }
      className={`theme-filter-button flex items-center gap-1.5 rounded-lg border border-theme-border bg-theme-surface px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-theme-muted transition-colors hover:border-theme-accent/30 hover:bg-theme-surface-elevated hover:text-theme-text ${className}`}
      data-active="true"
    >
      <span className="text-theme-accent-strong">
        {isSquad ? <Users className="w-3 h-3" /> : <UsersRound className="w-3 h-3" />}
      </span>
      {isSquad ? "Squad Only" : "All Allies"}
    </button>
  );
}
