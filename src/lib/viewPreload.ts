export const VIEW_LOADERS = {
  overview: () => import("../views/OverviewView"),
  kdr: () => import("../views/KdrView"),
  "fight-breakdown": () => import("../views/FightBreakdownView"),
  "top-players": () => import("../views/TopPlayersView"),
  "top-skills": () => import("../views/TopSkillsView"),
  buffs: () => import("../views/BuffsView"),
  classes: () => import("../views/ClassesView"),
  "map-distribution": () => import("../views/MapDistributionView"),
  "commander-stats": () => import("../views/CommanderStatsHighlightsView"),
  "squad-stats": () => import("../views/SquadStatsView"),
  composition: () => import("../views/CompositionView"),
  offensive: () => import("../views/OffensiveView"),
  defensive: () => import("../views/DefensiveView"),
  roster: () => import("../views/RosterView"),
  "player-profiles": () => import("../views/PlayerProfilesView"),
  "player-compare": () => import("../views/PlayerCompareView"),
  "damage-modifiers": () => import("../views/DamageModifiersView"),
  rotations: () => import("../views/RotationsView"),
  "dps-graph": () => import("../views/DpsGraphView"),
  "fight-replay": () => import("../views/ReplayView"),
  mechanics: () => import("../views/MechanicsView"),
  "death-recap": () => import("../views/DeathRecapView"),
  "buff-generation": () => import("../views/BuffGenerationView"),
  conditions: () => import("../views/ConditionsView"),
  "party-boons": () => import("../views/PartyBoonsView"),
  highlights: () => import("../views/CommanderStatsHighlightsView"),
  archive: () => import("../views/ArchiveView"),
  compare: () => import("../views/CompareView"),
  intelligence: () => import("../views/IntelligenceDebugView"),
  insight: () => import("../views/InsightView"),
  raw: () => import("../views/RawView"),
  "axiforge-lab": () => import("../views/AxiForgeLabView"),
  "effective-power": () => import("../views/EffectivePowerView"),
} as const;

export type PreloadableView = keyof typeof VIEW_LOADERS;

const pendingViews = new Map<PreloadableView, Promise<unknown>>();

export function preloadView(view: string): Promise<unknown> | undefined {
  if (!(view in VIEW_LOADERS)) return undefined;

  const key = view as PreloadableView;
  const existing = pendingViews.get(key);
  if (existing) return existing;

  const pending = VIEW_LOADERS[key]().catch(() => {
    pendingViews.delete(key);
    return undefined;
  });
  pendingViews.set(key, pending);
  return pending;
}

interface IdlePreloadOptions {
  delayMs?: number;
  maxViews?: number;
}

export function preloadViewsWhenIdle(
  views: readonly string[],
  { delayMs = 450, maxViews = 4 }: IdlePreloadOptions = {},
): () => void {
  if (typeof window === "undefined") return () => {};

  const queue = [...new Set(views)]
    .filter((view): view is PreloadableView => view in VIEW_LOADERS)
    .slice(0, maxViews);
  let cancelled = false;
  let delayId: number | undefined;
  let idleId: number | undefined;

  const scheduleNext = () => {
    if (cancelled || queue.length === 0) return;
    delayId = window.setTimeout(() => {
      if (cancelled) return;

      const run = () => {
        if (cancelled) return;
        const view = queue.shift();
        if (!view) return;
        void preloadView(view)?.finally(scheduleNext);
      };

      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(run, { timeout: 1_500 });
      } else {
        run();
      }
    }, delayMs);
  };

  scheduleNext();
  return () => {
    cancelled = true;
    if (delayId !== undefined) window.clearTimeout(delayId);
    if (idleId !== undefined && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
  };
}
