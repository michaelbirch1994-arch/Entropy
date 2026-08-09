import type { ParsedReport } from '../bridge-metrics/positioning';
import type { CombatAgent, CombatEvent, CombatEventSet } from './CombatEvent';
import { STABILITY_BOON_ID, AEGIS_BOON_ID } from '../bridge-metrics/constants';

/**
 * Per-buff entry in the `buffUptimes` array, narrowed to the one field this
 * normalizer reads. See BuffUptimesEntry in dpsReportTypes.ts for the full
 * shape: `states` is `[timeMs, stackCount]` state-change pairs, sorted by
 * time ascending. Only populated for reports fetched via the dps.report
 * hosted API with full detail -- raw local Elite Insights JSON exports
 * typically do not include it (same caveat as damageTaken1S; see
 * normalizeDamage.ts).
 */
interface BuffUptimesEntryLike {
  id: number;
  states?: Array<[number, number]>;
}

const TRACKED_BOONS: Array<{ id: number; subcategory: 'stabilityLoss' | 'aegisLoss' }> = [
  { id: STABILITY_BOON_ID, subcategory: 'stabilityLoss' },
  { id: AEGIS_BOON_ID, subcategory: 'aegisLoss' },
];

function agentOf(p: any, playerIndex?: number): CombatAgent {
  return {
    name: p?.name ?? 'Unknown',
    account: p?.account ?? undefined,
    profession: p?.profession ?? undefined,
    kind: 'player',
    side: 'friendly',
    playerIndex,
  };
}

const squadOf = (r: ParsedReport): any[] =>
  ((r as any).details?.players ?? []).filter((p: any) => !p.notInSquad);

/**
 * Build Stability/Aegis LOSS CombatEvents for one log.
 *
 * A loss event fires the moment a tracked boon's stack count transitions
 * from >0 to 0 in a player's `buffUptimes[].states` stream. This does not
 * emit gain events -- the Defensive Failure detector this feeds (Phase 4
 * Tier 3) only needs to know when squad defensive coverage dropped, not
 * when it was refreshed. Non-Stability/Aegis boons are out of scope.
 *
 * Requires `states` on at least one squad player for one of the tracked
 * boons; if neither Stability nor Aegis has state data anywhere in the
 * squad, this returns confidence: 'none' rather than fabricate a loss.
 */
export function normalizeBoonLossEvents(report: ParsedReport): CombatEventSet {
  const squad = squadOf(report);
  const events: CombatEvent[] = [];
  let anyData = false;

  squad.forEach((p: any, playerIndex: number) => {
    const source = agentOf(p, playerIndex);
    const buffUptimes: BuffUptimesEntryLike[] = Array.isArray(p?.buffUptimes) ? p.buffUptimes : [];

    for (const { id, subcategory } of TRACKED_BOONS) {
      const entry = buffUptimes.find((b) => b.id === id);
      const states = entry?.states;
      if (!Array.isArray(states) || states.length === 0) continue;
      anyData = true;

      let previousStacks = 0;
      for (const [timeMs, stackCount] of states) {
        if (previousStacks > 0 && stackCount === 0) {
          events.push({
            timestampMs: timeMs,
            source,
            category: 'boon',
            subcategory,
            amount: 0,
            hits: 1,
            origin: 'dpsReport',
            confidence: 'medium',
            coverage: 'full',
          });
        }
        previousStacks = stackCount;
      }
    }
  });

  if (!anyData) {
    return {
      events: [],
      origin: 'dpsReport',
      confidence: 'none',
      note:
        'This log has no per-buff state-change timing (buffUptimes[].states) for ' +
        'Stability or Aegis. That field is only populated for reports fetched via ' +
        'the dps.report hosted API with full detail; raw local Elite Insights JSON ' +
        'exports do not include it, so boon-loss timing is unavailable for this log.',
      unattributed: 0,
    };
  }

  return {
    events: events.sort((a, b) => (a.timestampMs ?? 0) - (b.timestampMs ?? 0)),
    origin: 'dpsReport',
    confidence: 'medium',
    unattributed: 0,
  };
}

export const boonLossEvents = (set: CombatEventSet): CombatEvent[] =>
  set.events.filter((e) => e.category === 'boon');

export const stabilityLossEvents = (set: CombatEventSet): CombatEvent[] =>
  set.events.filter((e) => e.subcategory === 'stabilityLoss');

export const aegisLossEvents = (set: CombatEventSet): CombatEvent[] =>
  set.events.filter((e) => e.subcategory === 'aegisLoss');
