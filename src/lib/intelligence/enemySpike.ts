import { sortByTime } from '../combat/timeWindow';
import { resolveAgentIdentityKey, describeAgent } from '../combat/agentIdentity';
import { eventIdentity } from '../combat/CombatEvent';
import type { CombatEvent, CombatEventSet } from '../combat/CombatEvent';
import type { CriticalEvent } from './types';

export interface EnemySpikeOptions {
  /** Cluster window, ms. Damage-taken ticks within this of the cluster start are folded into the same spike. */
  windowMs?: number;
  /** Minimum distinct squad players hit within the cluster for it to count as a spike. */
  minPlayers?: number;
  /** How far past the cluster's last tick to look for downs/deaths the spike caused. */
  downLookaheadMs?: number;
}

const DEFAULT_WINDOW_MS = 3000;
const DEFAULT_MIN_PLAYERS = 3;

/**
 * Detects sudden bursts of incoming damage concentrated on the squad.
 *
 * Input is normalizeDamage.ts's per-second incoming-damage events, which
 * only exist for logs with `damageTaken1S` timing (reports fetched via the
 * dps.report hosted API; raw local Elite Insights JSON exports do not
 * include it -- see normalizeDamage.ts). On logs without that data
 * (`damageEventSet.confidence === 'none'`), this detector returns an empty
 * array rather than fabricate a spike from cruder aggregates.
 *
 * Clustering mirrors detectMassDowns in criticalEvents.ts: greedy,
 * non-overlapping windows, so no damage tick is double-counted across two
 * spikes. A cluster counts as a spike once >= minPlayers distinct squad
 * members were hit within windowMs of the cluster's first tick.
 *
 * Downs/deaths from downDeathEventSet that land within the cluster window
 * (plus downLookaheadMs) and target one of the affected players are
 * attached as evidence that the spike actually hurt the squad, not just
 * that damage numbers went up.
 */
export function detectEnemySpikes(
  damageEventSet: CombatEventSet,
  downDeathEventSet: CombatEventSet,
  fightId: string,
  options: EnemySpikeOptions = {},
): CriticalEvent[] {
  if (damageEventSet.confidence === 'none') return [];

  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const minPlayers = options.minPlayers ?? DEFAULT_MIN_PLAYERS;
  const downLookaheadMs = options.downLookaheadMs ?? windowMs;

  const hits = sortByTime(damageTakenEvents(damageEventSet)).filter(
    (e) => e.timestampMs !== null && e.target !== undefined && e.amount > 0,
  );
  if (hits.length === 0) return [];

  const downsDeaths = [...downEvents(downDeathEventSet), ...deathEvents(downDeathEventSet)];

  const results: CriticalEvent[] = [];
  let i = 0;
  while (i < hits.length) {
    const clusterStart = hits[i].timestampMs as number;
    const cluster = [hits[i]];
    let j = i + 1;
    while (j < hits.length && (hits[j].timestampMs as number) - clusterStart <= windowMs) {
      cluster.push(hits[j]);
      j++;
    }

    const distinctPlayers = new Set(cluster.map((e) => resolveAgentIdentityKey(e.target)));
    if (distinctPlayers.size >= minPlayers) {
      const clusterEnd = cluster[cluster.length - 1].timestampMs as number;
      const totalDamage = cluster.reduce((sum, e) => sum + e.amount, 0);

      const perPlayerDamage = new Map<string, number>();
      for (const e of cluster) {
        const key = resolveAgentIdentityKey(e.target);
        perPlayerDamage.set(key, (perPlayerDamage.get(key) ?? 0) + e.amount);
      }
      const peakPlayerDamage = Math.max(...perPlayerDamage.values());
      const concentration = totalDamage > 0 ? peakPlayerDamage / totalDamage : 0;
      const durationMs = clusterEnd - clusterStart + 1000;

      const affectedKeys = new Set(perPlayerDamage.keys());
      const resultingDownsDeaths = downsDeaths.filter((e) => {
        if (e.timestampMs === null) return false;
        if (e.timestampMs < clusterStart || e.timestampMs > clusterEnd + downLookaheadMs) return false;
        return affectedKeys.has(resolveAgentIdentityKey(e.source));
      });

      const playerNames = [...new Set(cluster.map((e) => describeAgent(e.target)))];
      const resultSuffix =
        resultingDownsDeaths.length > 0
          ? `, resulting in ${resultingDownsDeaths.length} down/death${resultingDownsDeaths.length === 1 ? '' : 's'}`
          : '';

      results.push({
        id: `enemy-spike:${fightId}:${clusterStart}`,
        timestampMs: clusterStart,
        fightId,
        category: 'defense',
        kind: 'enemy-spike',
        summary:
          `${distinctPlayers.size} squad players took a damage spike over ${(durationMs / 1000).toFixed(1)}s ` +
          `(${playerNames.join(', ')}), peaking at ${Math.round(concentration * 100)}% concentrated on one player` +
          `${resultSuffix}.`,
        relatedEvents: [
          ...cluster.map((e) => eventIdentity(e)),
          ...resultingDownsDeaths.map((e) => eventIdentity(e)),
        ],
        relatedPlayers: [...distinctPlayers],
        confidence: damageEventSet.confidence,
      });
    }
    i = j;
  }
  return results;
}

const damageTakenEvents = (set: CombatEventSet): CombatEvent[] =>
  set.events.filter((e) => e.category === 'damage');

const downEvents = (set: CombatEventSet): CombatEvent[] =>
  set.events.filter((e) => e.category === 'down');

const deathEvents = (set: CombatEventSet): CombatEvent[] =>
  set.events.filter((e) => e.category === 'death');
