import { describe, it, expect } from 'vitest';
import { detectDefensiveFailures } from '../intelligence/defensiveFailure';
import type { CombatEvent, CombatEventSet } from '../combat/CombatEvent';

const boonLoss = (
  timestampMs: number,
  sourceName: string,
  subcategory: 'stabilityLoss' | 'aegisLoss',
  overrides: Partial<CombatEvent> = {},
): CombatEvent => ({
  timestampMs,
  source: { name: sourceName, account: `${sourceName}.1`, kind: 'player' },
  category: 'boon',
  subcategory,
  amount: 0,
  hits: 1,
  origin: 'dpsReport',
  confidence: 'medium',
  coverage: 'full',
  ...overrides,
});

const downOrDeath = (
  timestampMs: number,
  sourceName: string,
  category: 'down' | 'death',
  overrides: Partial<CombatEvent> = {},
): CombatEvent => ({
  timestampMs,
  source: { name: sourceName, account: `${sourceName}.1`, kind: 'player' },
  category,
  subcategory: 'unknown',
  amount: 0,
  hits: 1,
  origin: 'eliteInsights',
  confidence: 'high',
  coverage: 'full',
  ...overrides,
});

const eventSet = (events: CombatEvent[], confidence: CombatEventSet['confidence'] = 'medium'): CombatEventSet => ({
  events,
  origin: 'dpsReport',
  confidence,
  unattributed: 0,
});

describe('detectDefensiveFailures', () => {
  it('flags a Stability loss followed by the same player going down within the window', () => {
    const boonLosses = eventSet([boonLoss(1000, 'Alice', 'stabilityLoss')]);
    const downsDeaths = eventSet([downOrDeath(2500, 'Alice', 'down')], 'high');

    const failures = detectDefensiveFailures(boonLosses, downsDeaths, 'fight-1', { windowMs: 4000 });

    expect(failures).toHaveLength(1);
    expect(failures[0].kind).toBe('defensive-failure');
    expect(failures[0].fightId).toBe('fight-1');
    expect(failures[0].timestampMs).toBe(1000);
    expect(failures[0].relatedPlayers).toEqual(['player:Alice.1']);
    expect(failures[0].summary).toMatch(/Stability/);
    expect(failures[0].summary).toMatch(/went down/);
  });

  it('flags an Aegis loss followed by the same player dying, labeling it a death', () => {
    const boonLosses = eventSet([boonLoss(1000, 'Bob', 'aegisLoss')]);
    const downsDeaths = eventSet([downOrDeath(1800, 'Bob', 'death')], 'high');

    const failures = detectDefensiveFailures(boonLosses, downsDeaths, 'fight-1');

    expect(failures).toHaveLength(1);
    expect(failures[0].summary).toMatch(/Aegis/);
    expect(failures[0].summary).toMatch(/died/);
  });

  it('does not match a down/death for a different player', () => {
    const boonLosses = eventSet([boonLoss(1000, 'Alice', 'stabilityLoss')]);
    const downsDeaths = eventSet([downOrDeath(1500, 'Bob', 'down')], 'high');

    const failures = detectDefensiveFailures(boonLosses, downsDeaths, 'fight-1');

    expect(failures).toHaveLength(0);
  });

  it('does not match a down/death outside the window', () => {
    const boonLosses = eventSet([boonLoss(1000, 'Alice', 'stabilityLoss')]);
    const downsDeaths = eventSet([downOrDeath(10000, 'Alice', 'down')], 'high');

    const failures = detectDefensiveFailures(boonLosses, downsDeaths, 'fight-1', { windowMs: 4000 });

    expect(failures).toHaveLength(0);
  });

  it('does not match a down/death that happened before the loss', () => {
    const boonLosses = eventSet([boonLoss(5000, 'Alice', 'stabilityLoss')]);
    const downsDeaths = eventSet([downOrDeath(1000, 'Alice', 'down')], 'high');

    const failures = detectDefensiveFailures(boonLosses, downsDeaths, 'fight-1');

    expect(failures).toHaveLength(0);
  });

  it('does not double-claim the same down for two boon losses', () => {
    const boonLosses = eventSet([
      boonLoss(1000, 'Alice', 'stabilityLoss'),
      boonLoss(1500, 'Alice', 'aegisLoss'),
    ]);
    const downsDeaths = eventSet([downOrDeath(2000, 'Alice', 'down')], 'high');

    const failures = detectDefensiveFailures(boonLosses, downsDeaths, 'fight-1', { windowMs: 4000 });

    expect(failures).toHaveLength(1);
    expect(failures[0].summary).toMatch(/Stability/);
  });

  it('does not fabricate failures when the boon-loss event set has no confidence', () => {
    const boonLosses = eventSet([boonLoss(1000, 'Alice', 'stabilityLoss')], 'none');
    const downsDeaths = eventSet([downOrDeath(1500, 'Alice', 'down')], 'high');

    const failures = detectDefensiveFailures(boonLosses, downsDeaths, 'fight-1');

    expect(failures).toHaveLength(0);
  });
});
