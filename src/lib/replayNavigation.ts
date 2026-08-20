import type { ReplayFightEntry } from "../types/report";
import type { ViewNavigationTarget } from "../store/ViewContext";

export interface ResolvedReplayNavigationTarget {
  fightIndex: number;
  fightId: string;
  timestampMs: number;
  account?: string;
  eventId?: string;
  metric?: string;
  source: ViewNavigationTarget["source"];
}

/**
 * Resolve a cross-view evidence request into a safe Fight Replay seek target.
 * This does not infer fight identity or replay state: the caller must supply
 * an exact timestamp plus either the stable fight id or a legacy fight index.
 */
export function resolveReplayNavigationTarget(
  fights: ReplayFightEntry[] | undefined,
  target: ViewNavigationTarget | null,
): ResolvedReplayNavigationTarget | null {
  if (!fights?.length || !target) return null;
  if (target.targetView !== "fight-replay") return null;

  const timestampMs = Number(target.timestampMs);
  if (!Number.isFinite(timestampMs)) return null;

  let fightIndex = -1;
  if (typeof target.fightId === "string" && target.fightId.trim()) {
    fightIndex = fights.findIndex((fight) => fight.fightId === target.fightId);
  } else {
    const legacyFightIndex = Number(target.fightIndex);
    if (Number.isInteger(legacyFightIndex) && legacyFightIndex >= 0 && legacyFightIndex < fights.length) {
      fightIndex = legacyFightIndex;
    }
  }
  if (fightIndex < 0) return null;

  const durationMs = Math.max(0, Number(fights[fightIndex]?.data.durationMs) || 0);
  return {
    fightIndex,
    fightId: fights[fightIndex].fightId,
    timestampMs: Math.min(durationMs, Math.max(0, timestampMs)),
    account: target.account,
    eventId: target.eventId,
    metric: target.metric,
    source: target.source,
  };
}
