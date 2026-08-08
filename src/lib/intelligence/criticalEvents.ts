/**
 * Tier 1 Critical Event detectors -- the only detectors buildable today
 * without a new normalizer, because they operate solely on down/death
 * events (normalizeDeaths.ts) which already exist. See
 * docs/INTELLIGENCE_ROADMAP.md for the Tier 2-4 plan.
 *
 * ---------------------------------------------------------------------------
 * SCOPE -- read before adding a detector here
 * ---------------------------------------------------------------------------
 * normalizeDeaths.ts only produces events for SQUAD players (it reads
 * squadOf(report), not enemy players). That means every detector in this
 * file describes something that happened TO the squad, not something the
 * squad did to the enemy. In particular, the original Phase 4 spec asked
 * for a "Kill Conversion" detector (enemy down -> enemy death = good for
 * us). That is deliberately NOT implemented here: building it would
 * require enemy down/death events that do not exist as a normalized
 * stream, and labeling a squad player's own down-into-death as a "Kill
 * Conversion" would invert its meaning. What IS implemented instead is
 * "Failed Recovery" -- the squad-side mirror of the same down-to-death
 * linkage, which the data actually supports.
 */

import { downEvents, deathEvents } from '../combat/normalizeDeaths';
import { resolveAgentIdentityKey, describeAgent } from '../combat/agentIdentity';
import { sortByTime } from '../combat/timeWindow';
import { eventIdentity, type CombatEventSet } from '../combat/CombatEvent';
import type { CriticalEvent } from './types';

export interface MassDownOptions {
  windowMs?: number;
  minPlayers?: number;
}

const DEFAULT_MASS_DOWN_WINDOW_MS = 3000;
const DEFAULT_MASS_DOWN_MIN_PLAYERS = 3;

/**
 * Groups of >= minPlayers distinct squad members downed within windowMs of
 * each other. Greedy, non-overlapping: once a cluster is emitted, the next
 * cluster search starts after it, so no down event is double-counted.
 */
export function detectMassDowns(
  eventSet: CombatEventSet,
  fightId: string,
  options: MassDownOptions = {},
): CriticalEvent[] {
  const windowMs = options.windowMs ?? DEFAULT_MASS_DOWN_WINDOW_MS;
  const minPlayers = options.minPlayers ?? DEFAULT_MASS_DOWN_MIN_PLAYERS;
  const downs = sortByTime(downEvents(eventSet)).filter((e) => e.timestampMs !== null);

  const results: CriticalEvent[] = [];
  let i = 0;
  while (i < downs.length) {
    const clusterStart = downs[i].timestampMs as number;
    const cluster = [downs[i]];
    let j = i + 1;
    while (j < downs.length && (downs[j].timestampMs as number) - clusterStart <= windowMs) {
      cluster.push(downs[j]);
      j++;
    }
    const distinctPlayers = new Set(cluster.map((e) => resolveAgentIdentityKey(e.source)));
    if (distinctPlayers.size >= minPlayers) {
      const playerNames = [...new Set(cluster.map((e) => describeAgent(e.source)))];
      results.push({
        id: `mass-down:${fightId}:${clusterStart}`,
        timestampMs: clusterStart,
        fightId,
        category: 'defense',
        kind: 'mass-down',
        summary: `${distinctPlayers.size} squad players downed within ${(windowMs / 1000).toFixed(1)}s (${playerNames.join(', ')}).`,
        relatedEvents: cluster.map((e) => eventIdentity(e)),
        relatedPlayers: [...distinctPlayers],
        confidence: eventSet.confidence,
      });
    }
    i = j;
  }
  return results;
}

export interface FailedRecoveryOptions {
  minTimeToDeathMs?: number;
}

const DEFAULT_FAILED_RECOVERY_MIN_MS = 0;

/**
 * A "failed recovery" is a down that has a linked death (see
 * normalizeDeaths.ts: metadata.linkedDeathMs was matched against a real
 * `dead` timestamp for the same player). This does NOT try to guess why
 * the rally failed -- no revive-attempt data exists in this pipeline -- it
 * only reports that a down did not end in a rally.
 */
export function detectFailedRecoveries(
  eventSet: CombatEventSet,
  fightId: string,
  options: FailedRecoveryOptions = {},
): CriticalEvent[] {
  const minMs = options.minTimeToDeathMs ?? DEFAULT_FAILED_RECOVERY_MIN_MS;
  const deaths = deathEvents(eventSet).filter((e) => e.metadata?.precededByDown === true);

  return deaths
    .filter((e) => {
      const t = e.metadata?.timeToDeathMs;
      return typeof t === 'number' && t >= minMs;
    })
    .map((death) => {
      const downStartMs = death.metadata?.downStartMs as number | undefined;
      const timeToDeathMs = death.metadata?.timeToDeathMs as number;
      return {
        id: `failed-recovery:${fightId}:${death.timestampMs}`,
        timestampMs: downStartMs ?? (death.timestampMs as number),
        fightId,
        category: 'defense',
        kind: 'failed-recovery',
        summary: `${describeAgent(death.source)} went down and died ${(timeToDeathMs / 1000).toFixed(1)}s later without being rallied.`,
        relatedEvents: [eventIdentity(death)],
        relatedPlayers: [resolveAgentIdentityKey(death.source)],
        confidence: eventSet.confidence,
      } satisfies CriticalEvent;
    });
}
