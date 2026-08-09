import { describe, it, expect } from 'vitest';
import { detectEnemySpikes } from '../intelligence/enemySpike';
import type { CombatEvent, CombatEventSet } from '../combat/CombatEvent';

const dmg = (timestampMs: number, targetName: string, amount: number, overrides: Partial<CombatEvent> = {}): CombatEvent => ({
  timestampMs,
  source: { name: 'Enemy', account: undefined, kind: 'unknown' },
  target: { name: targetName, account: `${targetName}.1`, kind: 'player' },
  category: 'damage',
  subcategory: 'unknown',
  amount,
  hits: 1,
  origin: 'dpsReport',
  confidence: 'high',
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

describe('detectEnemySpikes', () => {
  it('flags a cluster of 3+ distinct squad players hit within the window', () => {
    const damage = eventSet([
      dmg(1000, 'Alice', 500),
      dmg(1200, 'Bob', 400),
      dmg(1400, 'Carol', 300),
    ]);
    const downDeath = eventSet([]);

    const spikes = detectEnemySpikes(damage, downDeath, 'fight-1', { windowMs: 3000, minPlayers: 3 });

    expect(spikes).toHaveLength(1);
    expect(spikes[0].fightId).toBe('fight-1');
    expect(spikes[0].kind).toBe('enemy-spike');
    expect(spikes[0].timestampMs).toBe(1000);
    expect(spikes[0].relatedPlayers).toHaveLength(3);
  });

  it('does not flag when fewer than minPlayers are hit together', () => {
    const damage = eventSet([dmg(1000, 'Alice', 500), dmg(1200, 'Bob', 400)]);
    const downDeath = eventSet([]);

    const spikes = detectEnemySpikes(damage, downDeath, 'fight-1', { windowMs: 3000, minPlayers: 3 });

    expect(spikes).toHaveLength(0);
  });

  it('does not double-count damage ticks across two non-overlapping spikes', () => {
    const damage = eventSet([
      dmg(1000, 'Alice', 500),
      dmg(1200, 'Bob', 400),
      dmg(1400, 'Carol', 300),
      dmg(20000, 'Dave', 500),
      dmg(20200, 'Erin', 400),
      dmg(20400, 'Frank', 300),
    ]);
    const downDeath = eventSet([]);

    const spikes = detectEnemySpikes(damage, downDeath, 'fight-1', { windowMs: 3000, minPlayers: 3 });

    expect(spikes).toHaveLength(2);
    expect(spikes[0].relatedEvents).toHaveLength(3);
    expect(spikes[1].relatedEvents).toHaveLength(3);
  });

  it('attaches downs/deaths within the lookahead window as evidence', () => {
    const damage = eventSet([
      dmg(1000, 'Alice', 500),
      dmg(1200, 'Bob', 400),
      dmg(1400, 'Carol', 300),
    ]);
    const downDeath = eventSet([
      downOrDeath(2000, 'Alice', 'down'),
      downOrDeath(9000, 'Bob', 'down'),
    ]);

    const spikes = detectEnemySpikes(damage, downDeath, 'fight-1', { windowMs: 3000, minPlayers: 3, downLookaheadMs: 3000 });

    expect(spikes).toHaveLength(1);
    expect(spikes[0].relatedEvents).toHaveLength(4);
    expect(spikes[0].summary).toMatch(/1 down\/death/);
  });

  it('ignores downs/deaths belonging to players the spike did not hit', () => {
    const damage = eventSet([
      dmg(1000, 'Alice', 500),
      dmg(1200, 'Bob', 400),
      dmg(1400, 'Carol', 300),
    ]);
    const downDeath = eventSet([downOrDeath(2000, 'Dave', 'down')]);

    const spikes = detectEnemySpikes(damage, downDeath, 'fight-1', { windowMs: 3000, minPlayers: 3 });

    expect(spikes).toHaveLength(1);
    expect(spikes[0].relatedEvents).toHaveLength(3);
    expect(spikes[0].summary).not.toMatch(/down\/death/);
  });

  it('does not fabricate spikes when the damage event set has no confidence', () => {
    const damage = eventSet(
      [dmg(1000, 'Alice', 500), dmg(1200, 'Bob', 400), dmg(1400, 'Carol', 300)],
      'none',
    );
    const downDeath = eventSet([]);

    const spikes = detectEnemySpikes(damage, downDeath, 'fight-1', { windowMs: 3000, minPlayers: 3 });

    expect(spikes).toHaveLength(0);
  });

  it('ignores zero/negative-amount damage ticks and null timestamps', () => {
    const damage = eventSet([
      dmg(1000, 'Alice', 500),
      dmg(1200, 'Bob', 0),
      dmg(1400, 'Carol', 300, { timestampMs: null }),
    ]);
    const downDeath = eventSet([]);

    const spikes = detectEnemySpikes(damage, downDeath, 'fight-1', { windowMs: 3000, minPlayers: 3 });

    expect(spikes).toHaveLength(0);
  });
});
