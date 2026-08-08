import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { normalizeDamageTakenEvents, damageTakenEvents } from '../combat/normalizeDamage';
import type { ParsedReport } from '../bridge-metrics/positioning';

function playerWithDamageTaken(
  name: string,
  damageTaken1S: number[][],
  overrides: Record<string, unknown> = {},
) {
  return {
    name,
    account: `${name}.1`,
    profession: 'Guardian',
    notInSquad: false,
    damageTaken1S,
    ...overrides,
  };
}

function reportOf(players: unknown[]): ParsedReport {
  return { details: { players } } as unknown as ParsedReport;
}

describe('normalizeDamageTakenEvents (synthetic)', () => {
  it('converts a cumulative damageTaken1S series into per-second delta events', () => {
    const players = [playerWithDamageTaken('Alice', [[0, 100, 100, 250, 250, 400]])];
    const set = normalizeDamageTakenEvents(reportOf(players));

    expect(set.confidence).toBe('medium');
    const events = damageTakenEvents(set);
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.timestampMs)).toEqual([1000, 3000, 5000]);
    expect(events.map((e) => e.amount)).toEqual([100, 150, 150]);
  });

  it('attributes source as an explicit unidentified-enemy agent, never a guess', () => {
    const players = [playerWithDamageTaken('Alice', [[0, 100]])];
    const set = normalizeDamageTakenEvents(reportOf(players));
    const [event] = damageTakenEvents(set);
    expect(event.source.side).toBe('enemy');
    expect(event.source.kind).toBe('unknown');
    expect(event.target?.side).toBe('friendly');
    expect(event.target?.account).toBe('Alice.1');
  });

  it('never labels the damage type -- subcategory stays unknown, not fabricated', () => {
    const players = [playerWithDamageTaken('Alice', [[0, 100]])];
    const set = normalizeDamageTakenEvents(reportOf(players));
    expect(damageTakenEvents(set)[0].subcategory).toBe('unknown');
  });

  it('excludes players not in the squad', () => {
    const players = [
      playerWithDamageTaken('Alice', [[0, 100]]),
      playerWithDamageTaken('Enemy Ally', [[0, 999]], { notInSquad: true }),
    ];
    const set = normalizeDamageTakenEvents(reportOf(players));
    expect(damageTakenEvents(set).every((e) => e.target?.account === 'Alice.1')).toBe(true);
  });

  it('produces zero events but medium confidence when data exists but no damage occurred', () => {
    const players = [playerWithDamageTaken('Alice', [[0, 0, 0, 0]])];
    const set = normalizeDamageTakenEvents(reportOf(players));
    expect(set.confidence).toBe('medium');
    expect(damageTakenEvents(set)).toHaveLength(0);
  });

  it('returns confidence none and an explanatory note when no squad player has damageTaken1S', () => {
    const players = [playerWithDamageTaken('Alice', [], {}), { name: 'Bob', account: 'Bob.1', notInSquad: false }];
    const set = normalizeDamageTakenEvents(reportOf(players));
    expect(set.confidence).toBe('none');
    expect(set.events).toHaveLength(0);
    expect(set.note).toMatch(/damageTaken1S/);
  });

  it('handles multiple squad players independently', () => {
    const players = [
      playerWithDamageTaken('Alice', [[0, 100]]),
      playerWithDamageTaken('Bob', [[0, 0, 300]]),
    ];
    const set = normalizeDamageTakenEvents(reportOf(players));
    const events = damageTakenEvents(set);
    expect(events).toHaveLength(2);
    const alice = events.find((e) => e.target?.account === 'Alice.1');
    const bob = events.find((e) => e.target?.account === 'Bob.1');
    expect(alice?.amount).toBe(100);
    expect(bob?.amount).toBe(300);
  });
});

describe('normalizeDamageTakenEvents against the real fixture', () => {
  it('honestly reports zero events because the raw Elite Insights export has no per-second timing (documented, not a bug)', () => {
    const raw = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'wvw-modern-ei.json'), 'utf-8'));
    const report: ParsedReport = { details: raw };
    const set = normalizeDamageTakenEvents(report);

    expect(set.confidence).toBe('none');
    expect(set.events).toHaveLength(0);
    expect(set.note).toMatch(/damageTaken1S/);
  });
});
