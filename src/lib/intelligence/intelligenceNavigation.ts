import type { ViewNavigationTarget } from "../../store/ViewContext";
import type { FightRow } from "../../types/report";
import type { CriticalEvent } from "./types";

export interface ResolvedIntelligenceNavigationTarget {
  fightId: string;
  fightIndex: number;
  timestampMs: number;
  account?: string;
  metric?: string;
  source: ViewNavigationTarget["source"];
  matchedEventId?: string;
  matchedEventOffsetMs?: number;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function fightAliases(fight: FightRow, index: number): string[] {
  return [
    fight.id,
    fight.label,
    fight.fullLabel,
    fight.permalink,
    `fight-${index + 1}`,
    `${fight.mapName}-${index}`,
    `${fight.fullLabel}-${index}`,
  ].filter((value): value is string => Boolean(value));
}

function resolveFight(
  fights: FightRow[],
  target: ViewNavigationTarget,
): { fight: FightRow; fightIndex: number } | null {
  if (target.fightId) {
    const normalizedTarget = normalizeKey(target.fightId);
    const fightIndex = fights.findIndex((fight, index) =>
      fightAliases(fight, index).some((alias) => normalizeKey(alias) === normalizedTarget),
    );
    return fightIndex >= 0 ? { fight: fights[fightIndex], fightIndex } : null;
  }

  if (typeof target.fightIndex === "number" && target.fightIndex >= 0 && target.fightIndex < fights.length) {
    return { fight: fights[target.fightIndex], fightIndex: target.fightIndex };
  }

  return null;
}

/**
 * Resolves a cross-view evidence target without inventing an Intelligence event.
 * The exact source timestamp is preserved unless the caller supplied a persisted
 * event id. A nearby persisted event may be selected for inspection, but only
 * inside the explicit proximity window.
 */
export function resolveIntelligenceNavigationTarget(
  fights: FightRow[],
  criticalEvents: CriticalEvent[],
  target: ViewNavigationTarget | null | undefined,
  proximityWindowMs = 15_000,
): ResolvedIntelligenceNavigationTarget | null {
  if (!target || target.targetView !== "intelligence") return null;

  const exactEvent = target.eventId
    ? criticalEvents.find((event) => event.id === target.eventId)
    : undefined;

  if (exactEvent) {
    const exactFightTarget: ViewNavigationTarget = {
      ...target,
      fightId: exactEvent.fightId,
    };
    const resolvedFight = resolveFight(fights, exactFightTarget);
    if (!resolvedFight) return null;
    return {
      fightId: resolvedFight.fight.id,
      fightIndex: resolvedFight.fightIndex,
      timestampMs: exactEvent.timestampMs,
      account: target.account,
      metric: target.metric,
      source: target.source,
      matchedEventId: exactEvent.id,
      matchedEventOffsetMs: 0,
    };
  }

  if (!Number.isFinite(target.timestampMs)) return null;
  const resolvedFight = resolveFight(fights, target);
  if (!resolvedFight) return null;

  const timestampMs = Math.max(0, target.timestampMs as number);
  const maxOffset = Math.max(0, proximityWindowMs);
  const resolvedFightAliases = new Set(
    fightAliases(resolvedFight.fight, resolvedFight.fightIndex).map(normalizeKey),
  );
  const candidates = criticalEvents
    .filter((event) => resolvedFightAliases.has(normalizeKey(event.fightId)))
    .map((event) => ({
      event,
      offsetMs: Math.abs(event.timestampMs - timestampMs),
    }))
    .filter((candidate) => candidate.offsetMs <= maxOffset)
    .sort((a, b) =>
      a.offsetMs - b.offsetMs
      || a.event.timestampMs - b.event.timestampMs
      || a.event.id.localeCompare(b.event.id),
    );

  const normalizedAccount = target.account ? normalizeKey(target.account) : "";
  const accountCandidates = normalizedAccount
    ? candidates.filter(({ event }) =>
      event.relatedPlayers?.some((player) => normalizeKey(player) === normalizedAccount),
    )
    : [];
  const matched = accountCandidates[0] ?? candidates[0];

  return {
    fightId: resolvedFight.fight.id,
    fightIndex: resolvedFight.fightIndex,
    timestampMs,
    account: target.account,
    metric: target.metric,
    source: target.source,
    matchedEventId: matched?.event.id,
    matchedEventOffsetMs: matched?.offsetMs,
  };
}
