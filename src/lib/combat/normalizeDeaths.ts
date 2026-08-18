/**
 * Normalizer: Elite Insights replay down/death timing -> CombatEvent[].
 *
 * ---------------------------------------------------------------------------
 * SCOPE
 * ---------------------------------------------------------------------------
 * This is the first normalizer that emits REAL timestamps (`timestampMs`
 * is never null here) rather than phase aggregates. That is the whole point of
 * it: down/death events are the timing anchors every future correlation query
 * ("what happened 2 seconds before this down?") needs, and nothing in the
 * existing pipeline currently exposes them as a flat, timestamped stream.
 *
 * This does NOT attempt to explain *why* a player died. DeathRecapView and
 * positioning.ts's out-of-position-death logic already do targeted causal
 * work for their own views; duplicating that here would be exactly the
 * "invented intelligence" this layer is supposed to avoid. This module only
 * answers "when", not "why" — cause-of-death correlation is explicitly a
 * later phase (see docs/COMBAT_EVENT_ARCHITECTURE.md).
 *
 * Reuses `classifyDegree` from positioning.ts rather than re-deriving replay
 * availability rules — that gating logic (commander tag present, polling rate
 * and inchToPixel populated) is already implemented and tested there.
 */

import { classifyDegree, type ParsedReport } from '../bridge-metrics/positioning';
import type { CombatAgent, CombatEvent, CombatEventSet } from './CombatEvent';

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function agentOf(p: any, playerIndex?: number): CombatAgent {
  return {
    name: p?.name ?? 'Unknown',
    account: p?.account ?? undefined,
    profession: p?.profession ?? undefined,
    kind: 'player',
    playerIndex,
  };
}

const squadOf = (r: ParsedReport): any[] => (r.details?.players ?? []).filter((p: any) => !p?.notInSquad);

/**
 * Build down/death CombatEvents for one log.
 *
 * Requires full-degree replay data (commander tag + positions + polling
 * metadata) because down/dead arrays are only meaningfully timestamped at
 * that degree — coarse mode has no per-tick timeline to anchor them to.
 * Below `full`, this returns an empty set with `confidence: 'none'` and an
 * explanatory note, matching the convention in dataIntegrity.ts: absence of
 * data is reported, never silently treated as "no downs occurred".
 */
export function normalizeDeathEvents(report: ParsedReport): CombatEventSet {
  const degree = classifyDegree(report);
  if (degree !== 'full') {
    return {
      events: [],
      origin: 'eliteInsights',
      confidence: 'none',
      note:
        degree === 'coarse'
          ? 'This log has commander-distance stats but no full positional replay, so down/death events cannot be timestamped.'
          : 'This log has no replay data (no commander tag or missing polling metadata), so down/death timing is unavailable.',
      unattributed: 0,
    };
  }

  const squad = squadOf(report);
  const events: CombatEvent[] = [];

  for (const player of squad) {
    const replay = player?.combatReplayData;
    if (!replay || !Array.isArray(replay.down) || !Array.isArray(replay.dead)) continue;
    const source = agentOf(player);

    // Same construction as positioning.ts's linkedDeathHits: a `dead` entry's
    // first value is a death timestamp; it is "linked" to a down when that
    // timestamp also appears as a down entry's second value.
    const deadTimestamps = new Set<number>();
    for (const entry of replay.dead) {
      if (Array.isArray(entry) && Number.isFinite(Number(entry[0])) && Number(entry[0]) > 0) {
        deadTimestamps.add(Number(entry[0]));
      }
    }

    const linkedDeathTimestamps = new Set<number>();

    for (const entry of replay.down) {
      if (!Array.isArray(entry)) continue;
      const downStartMs = Number(entry[0]);
      const linkedDeathMs = Number(entry[1]);
      if (!Number.isFinite(downStartMs) || downStartMs < 0) continue;

      const isLinkedDeath = deadTimestamps.has(linkedDeathMs);
      events.push({
        timestampMs: downStartMs,
        source,
        category: 'down',
        subcategory: 'unknown',
        // Down/death are marker events, not magnitude events — amount carries
        // no meaning here. Kept at 0 rather than omitted so every CombatEvent
        // has a well-defined `amount` for callers that sum indiscriminately.
        amount: 0,
        hits: 1,
        origin: 'eliteInsights',
        confidence: 'high',
        coverage: 'full',
        metadata: isLinkedDeath ? { linkedDeathMs } : { linkedDeathMs: null },
      });

      if (isLinkedDeath) {
        linkedDeathTimestamps.add(linkedDeathMs);
        events.push({
          timestampMs: linkedDeathMs,
          source,
          category: 'death',
          subcategory: 'unknown',
          amount: 0,
          hits: 1,
          origin: 'eliteInsights',
          confidence: 'high',
          coverage: 'full',
          metadata: { downStartMs, timeToDeathMs: linkedDeathMs - downStartMs, precededByDown: true },
        });
      }
    }

    // Deaths with no preceding down at all (e.g. instant-execute mechanics)
    // still belong in the stream — reported as death events with
    // `precededByDown: false` rather than dropped.
    for (const ts of deadTimestamps) {
      if (linkedDeathTimestamps.has(ts)) continue;
      events.push({
        timestampMs: ts,
        source,
        category: 'death',
        subcategory: 'unknown',
        amount: 0,
        hits: 1,
        origin: 'eliteInsights',
        confidence: 'high',
        coverage: 'full',
        metadata: { downStartMs: null, precededByDown: false },
      });
    }
  }

  return {
    events,
    origin: 'eliteInsights',
    confidence: 'high',
    unattributed: 0,
  };
}

export const downEvents = (set: CombatEventSet): CombatEvent[] => set.events.filter((e) => e.category === 'down');
export const deathEvents = (set: CombatEventSet): CombatEvent[] => set.events.filter((e) => e.category === 'death');
