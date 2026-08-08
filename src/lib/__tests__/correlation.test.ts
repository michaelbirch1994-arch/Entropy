import { describe, it, expect } from 'vitest';
import {
  withinSeconds,
  beforeEvent,
  afterEvent,
  sameSource,
  sameTarget,
  distinctSourceCount,
  affectsAtLeast,
  eventsNear,
} from '../intelligence/correlation';
import type { CombatEvent } from '../combat/CombatEvent';

const evt = (timestampMs: number | null, overrides: Partial<CombatEvent> = {}): CombatEvent => ({
  timestampMs,
  source: { name: 'P1', account: 'P1.1', kind: 'player' },
  category: 'down',
  subcategory: 'unknown',
  amount: 0,
  hits: 1,
  origin: 'eliteInsights',
  confidence: 'high',
  coverage: 'full',
  ...overrides,
});

describe('withinSeconds / beforeEvent / afterEvent', () => {
  it('withinSeconds is symmetric and inclusive of the boundary', () => {
    const a = evt(1000);
    const b = evt(3000);
    expect(withinSeconds(a, b, 2000)).toBe(true);
    expect(withinSeconds(b, a, 2000)).toBe(true);
    expect(withinSeconds(a, b, 1999)).toBe(false);
  });

  it('returns false when either event has a null timestamp', () => {
    expect(withinSeconds(evt(null), evt(1000), 5000)).toBe(false);
  });

  it('beforeEvent/afterEvent are strict and null-safe', () => {
    expect(beforeEvent(evt(1000), evt(2000))).toBe(true);
    expect(beforeEvent(evt(2000), evt(1000))).toBe(false);
    expect(afterEvent(evt(2000), evt(1000))).toBe(true);
    expect(beforeEvent(evt(null), evt(1000))).toBe(false);
  });
});

describe('sameSource / sameTarget', () => {
  it('matches on agent identity, not object reference', () => {
    const a = evt(1000, { source: { name: 'Bob', account: 'Bob.1234', kind: 'player' } });
    const b = evt(2000, { source: { name: 'Bob-alt-char', account: 'Bob.1234', kind: 'player' } });
    expect(sameSource(a, b)).toBe(true);
  });

  it('sameTarget is false when either side has no target', () => {
    const a = evt(1000, { target: { name: 'Ann', account: 'Ann.1', kind: 'player' } });
    const b = evt(2000);
    expect(sameTarget(a, b)).toBe(false);
  });

  it('sameTarget matches when both targets resolve to the same identity', () => {
    const a = evt(1000, { target: { name: 'Ann', account: 'Ann.1', kind: 'player' } });
    const b = evt(2000, { target: { name: 'Ann', account: 'Ann.1', kind: 'player' } });
    expect(sameTarget(a, b)).toBe(true);
  });
});

describe('distinctSourceCount / affectsAtLeast', () => {
  const events = [
    evt(1000, { source: { name: 'A', account: 'A.1', kind: 'player' } }),
    evt(1500, { source: { name: 'A', account: 'A.1', kind: 'player' } }),
    evt(2000, { source: { name: 'B', account: 'B.1', kind: 'player' } }),
    evt(2500, { source: { name: 'C', account: 'C.1', kind: 'player' } }),
  ];

  it('counts distinct players, not events', () => {
    expect(distinctSourceCount(events)).toBe(3);
  });

  it('affectsAtLeast checks against the distinct count', () => {
    expect(affectsAtLeast(events, 3)).toBe(true);
    expect(affectsAtLeast(events, 4)).toBe(false);
  });
});

describe('eventsNear', () => {
  it('excludes the center event and respects the window', () => {
    const center = evt(2000);
    const events = [evt(500), evt(1000), center, evt(3000), evt(4500)];
    const near = eventsNear(events, center, 1000);
    expect(near.map((e) => e.timestampMs).sort()).toEqual([1000, 3000]);
    expect(near).not.toContain(center);
  });

  it('returns empty for a phase-aggregate (null-timestamp) center', () => {
    expect(eventsNear([evt(1000)], evt(null), 5000)).toEqual([]);
  });
});
