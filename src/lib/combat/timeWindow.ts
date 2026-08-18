/**
 * Time-correlation primitives over CombatEvent[].
 *
 * ---------------------------------------------------------------------------
 * SCOPE RULE
 * ---------------------------------------------------------------------------
 * These are reusable BUILDING BLOCKS ("events near this timestamp", "events in
 * this range"), not fight-diagnosis algorithms. Nothing here decides what a
 * spike is, what a stability gap is, or what caused a death — those are
 * Critical Event Detection (a later phase). This module only answers "what
 * happened when", which every later correlation query needs as a foundation.
 *
 * Phase-aggregate events (`timestampMs === null`, e.g. today's healing
 * normalizer output) are excluded from every function here rather than
 * silently treated as `0` — see `timestamped()`.
 */

import type { CombatEvent } from './CombatEvent';

/** Events that carry a real timestamp, excluding phase-aggregate events. */
/** A CombatEvent proven (by `timestamped()`) to carry a real, non-null timestamp. */
export type TimestampedEvent = CombatEvent & { timestampMs: number };

export function timestamped(events: CombatEvent[]): TimestampedEvent[] {
  return events.filter((e): e is TimestampedEvent => e.timestampMs !== null);
}

/**
 * Events within `windowMs` of `centerMs` on either side (inclusive).
 * Example: "what happened within 2s of this down?" -> windowMs = 2000.
 */
export function eventsInWindow(events: CombatEvent[], centerMs: number, windowMs: number): CombatEvent[] {
  const lo = centerMs - windowMs;
  const hi = centerMs + windowMs;
  return timestamped(events).filter((e) => e.timestampMs >= lo && e.timestampMs <= hi);
}

/** Events strictly between two timestamps (inclusive of both bounds). */
export function eventsBetween(events: CombatEvent[], startMs: number, endMs: number): CombatEvent[] {
  const lo = Math.min(startMs, endMs);
  const hi = Math.max(startMs, endMs);
  return timestamped(events).filter((e) => e.timestampMs >= lo && e.timestampMs <= hi);
}

/** Events strictly before a timestamp, most recent first. Useful for "what led up to this?" queries. */
export function eventsBefore(events: CombatEvent[], ts: number, limit?: number): CombatEvent[] {
  const before = timestamped(events)
    .filter((e) => e.timestampMs < ts)
    .sort((a, b) => b.timestampMs - a.timestampMs);
  return typeof limit === 'number' ? before.slice(0, limit) : before;
}

/** Events strictly after a timestamp, earliest first. */
export function eventsAfter(events: CombatEvent[], ts: number, limit?: number): CombatEvent[] {
  const after = timestamped(events)
    .filter((e) => e.timestampMs > ts)
    .sort((a, b) => a.timestampMs - b.timestampMs);
  return typeof limit === 'number' ? after.slice(0, limit) : after;
}

/** Sort a copy of the event list by timestamp ascending. Phase-aggregate events sort last, stably. */
export function sortByTime(events: CombatEvent[]): CombatEvent[] {
  return [...events].sort((a, b) => {
    if (a.timestampMs === null && b.timestampMs === null) return 0;
    if (a.timestampMs === null) return 1;
    if (b.timestampMs === null) return -1;
    return a.timestampMs - b.timestampMs;
  });
}
