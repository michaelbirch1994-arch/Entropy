import { sortByTime } from '../combat/timeWindow';
import { resolveAgentIdentityKey, describeAgent } from '../combat/agentIdentity';
import { eventIdentity } from '../combat/CombatEvent';
import type { CombatEvent, CombatEventSet } from '../combat/CombatEvent';
import type { CriticalEvent } from './types';

export interface DefensiveFailureOptions {
  /** How long after a boon loss a down/death still counts as caused by it. */
  windowMs?: number;
}

const DEFAULT_WINDOW_MS = 4000;

const BOON_LABELS: Record<string, string> = {
  stabilityLoss: 'Stability',
  aegisLoss: 'Aegis',
};

/**
 * Detects a Stability or Aegis loss immediately followed by the same
 * player going down or dying -- the squad's defensive coverage failed and
 * the player paid for it.
 *
 * This requires the SAME player on both ends of the correlation, mirroring
 * detectFailedRecoveries's discipline in criticalEvents.ts: it does not
 * guess that a boon loss caused a down for someone else nearby, only that
 * the exact player who lost the boon went down or died shortly after.
 * Each down/death is claimed by at most one loss (the earliest matching
 * one), so a player who loses Stability twice before finally dying isn't
 * double-reported.
 *
 * Requires boonLossEventSet.confidence !== 'none' (see normalizeBoonLoss.ts);
 * on logs without Stability/Aegis state timing this returns [] rather than
 * fabricate a failure.
 */
export function detectDefensiveFailures(
  boonLossEventSet: CombatEventSet,
  downDeathEventSet: CombatEventSet,
  fightId: string,
  options: DefensiveFailureOptions = {},
): CriticalEvent[] {
  if (boonLossEventSet.confidence === 'none') return [];

  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;

  const losses = sortByTime(
    boonLossEventSet.events.filter(
      (e) => e.category === 'boon' && (e.subcategory === 'stabilityLoss' || e.subcategory === 'aegisLoss'),
    ),
  ).filter((e) => e.timestampMs !== null);

  const downsDeaths = sortByTime(
    downDeathEventSet.events.filter(
      (e) => (e.category === 'down' || e.category === 'death') && e.timestampMs !== null,
    ),
  );

  const claimed = new Set<CombatEvent>();
  const results: CriticalEvent[] = [];

  for (const loss of losses) {
    const lossKey = resolveAgentIdentityKey(loss.source);
    const lossMs = loss.timestampMs as number;

    const match = downsDeaths.find((e) => {
      if (claimed.has(e)) return false;
      if (resolveAgentIdentityKey(e.source) !== lossKey) return false;
      const t = e.timestampMs as number;
      return t >= lossMs && t - lossMs <= windowMs;
    });
    if (!match) continue;
    claimed.add(match);

    const matchMs = match.timestampMs as number;
    const boonLabel = BOON_LABELS[loss.subcategory] ?? loss.subcategory;
    const outcome = match.category === 'death' ? 'died' : 'went down';

    results.push({
      id: `defensive-failure:${fightId}:${lossMs}:${lossKey}`,
      timestampMs: lossMs,
      fightId,
      category: 'defense',
      kind: 'defensive-failure',
      summary: `${describeAgent(loss.source)} lost ${boonLabel} and ${outcome} ${(
        (matchMs - lossMs) /
        1000
      ).toFixed(1)}s later.`,
      relatedEvents: [eventIdentity(loss), eventIdentity(match)],
      relatedPlayers: [lossKey],
      confidence: boonLossEventSet.confidence,
    });
  }

  return results;
}
