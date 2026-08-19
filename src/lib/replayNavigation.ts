import type { ReplayFightEntry } from "../types/report";
import type { ViewNavigationTarget } from "../store/ViewContext";

export interface ResolvedReplayNavigationTarget {
  fightIndex: number;
  timestampMs: number;
  account?: string;
  eventId?: string;
}

/**
 * Resolve a cross-view Intelligence navigation request into a safe Fight Replay
 * seek target. This does not infer fight identity or replay state: the caller
 * must supply the exact replay fight index and timestamp captured by the
 * Intelligence evidence source.
 */
export function resolveReplayNavigationTarget(
  fights: ReplayFightEntry[] | undefined,
  target: ViewNavigationTarget | null,
): ResolvedReplayNavigationTarget | null {
  if (!fights?.length || !target) return null;
  if (target.source !== "intelligence" || target.targetView !== "fight-replay") return null;

  const fightIndex = Number(target.fightIndex);
  const timestampMs = Number(target.timestampMs);
  if (!Number.isInteger(fightIndex) || fightIndex < 0 || fightIndex >= fights.length) return null;
  if (!Number.isFinite(timestampMs)) return null;

  const durationMs = Math.max(0, Number(fights[fightIndex]?.data.durationMs) || 0);
  return {
    fightIndex,
    timestampMs: Math.min(durationMs, Math.max(0, timestampMs)),
    account: target.account,
    eventId: target.eventId,
  };
}
