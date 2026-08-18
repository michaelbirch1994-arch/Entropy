/**
 * Generic time/identity relationship helpers over CombatEvent[].
 *
 * These are reusable BUILDING BLOCKS for detectors (see criticalEvents.ts),
 * not detectors themselves. Nothing here decides what a "spike" or a
 * "critical event" is -- that decision logic lives one layer up, per the
 * Correlation-layer rule in docs/COMBAT_EVENT_ARCHITECTURE.md.
 */

import type { CombatEvent } from '../combat/CombatEvent';
import { resolveAgentIdentityKey } from '../combat/agentIdentity';
import { eventsInWindow } from '../combat/timeWindow';

export function withinSeconds(a: CombatEvent, b: CombatEvent, windowMs: number): boolean {
  if (a.timestampMs === null || b.timestampMs === null) return false;
  return Math.abs(a.timestampMs - b.timestampMs) <= windowMs;
}

export function beforeEvent(a: CombatEvent, b: CombatEvent): boolean {
  if (a.timestampMs === null || b.timestampMs === null) return false;
  return a.timestampMs < b.timestampMs;
}

export function afterEvent(a: CombatEvent, b: CombatEvent): boolean {
  if (a.timestampMs === null || b.timestampMs === null) return false;
  return a.timestampMs > b.timestampMs;
}

export function sameSource(a: CombatEvent, b: CombatEvent): boolean {
  return resolveAgentIdentityKey(a.source) === resolveAgentIdentityKey(b.source);
}

export function sameTarget(a: CombatEvent, b: CombatEvent): boolean {
  if (!a.target || !b.target) return false;
  return resolveAgentIdentityKey(a.target) === resolveAgentIdentityKey(b.target);
}

export function distinctSourceCount(events: CombatEvent[]): number {
  return new Set(events.map((e) => resolveAgentIdentityKey(e.source))).size;
}

export function affectsAtLeast(events: CombatEvent[], n: number): boolean {
  return distinctSourceCount(events) >= n;
}

/** Events within windowMs of `center`, excluding `center` itself. */
export function eventsNear(events: CombatEvent[], center: CombatEvent, windowMs: number): CombatEvent[] {
  if (center.timestampMs === null) return [];
  return eventsInWindow(events, center.timestampMs, windowMs).filter((e) => e !== center);
}
