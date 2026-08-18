// Down/death timing normalizer + time-window correlation primitives.
//
// Uses small hand-built replay fixtures rather than the full real-log
// fixtures — these tests are about timing/gating edge cases, which are
// clearer (and much faster) to express as minimal synthetic data than to
// hunt for in a 400KB real log.

import { describe, it, expect } from 'vitest';
import { normalizeDeathEvents, downEvents, deathEvents } from '../combat/normalizeDeaths';
import { eventsInWindow, eventsBetween, eventsBefore, eventsAfter, sortByTime, timestamped } from '../combat/timeWindow';
import type { CombatEvent } from '../combat/CombatEvent';
import type { ParsedReport } from '../bridge-metrics/positioning';

function fullReplayReport(players: any[]): ParsedReport {
  return {
    details: {
      players,
      combatReplayMetaData: { pollingRate: 150, inchToPixel: 40, sizes: [1000, 1000] },
      durationMS: 60000,
    },
  };
}

const commander = {
  name: 'Tag',
  account: 'Tag.1234',
  hasCommanderTag: true,
  combatReplayData: { positions: [[0, 0], [0, 0], [0, 0], [0, 0]], start: 0 },
};

function playerWithDownDeath(name: string, down: Array<[number, number]>, dead: Array<[number, number]>) {
  return {
    name,
    account: `${name}.9999`,
    combatReplayData: { positions: [[0, 0], [0, 0], [0, 0], [0, 0]], start: 0, down, dead },
  };
}

describe('normalizeDeathEvents — replay-degree gating', () => {
  it('returns an empty, none-confidence set when there is no replay data at all', () => {
    const report: ParsedReport = { details: { players: [{ name: 'Solo', account: 'Solo.1' }] } };
    const set = normalizeDeathEvents(report);
    expect(set.events).toHaveLength(0);
    expect(set.confidence).toBe('none');
    expect(set.note).toMatch(/replay data/i);
  });

  it('returns an empty, none-confidence set at coarse degree (no commander tag)', () => {
    const report: ParsedReport = {
      details: {
        players: [{ name: 'A', account: 'A.1', statsAll: [{ distToCom: 500 }] }],
      },
    };
    const set = normalizeDeathEvents(report);
    expect(set.events).toHaveLength(0);
    expect(set.confidence).toBe('none');
  });

  it('does not crash on a junk/empty report', () => {
    expect(normalizeDeathEvents({}).events).toHaveLength(0);
    expect(normalizeDeathEvents({ details: {} }).confidence).toBe('none');
  });
});

describe('normalizeDeathEvents — full degree', () => {
  it('emits a down event and a linked death event for a down that results in death', () => {
    const player = playerWithDownDeath('Bob', [[5000, 7500]], [[7500, 0]]);
    const report = fullReplayReport([commander, player]);
    const set = normalizeDeathEvents(report);

    expect(set.confidence).toBe('high');
    const downs = downEvents(set);
    const deaths = deathEvents(set);
    expect(downs).toHaveLength(1);
    expect(downs[0].timestampMs).toBe(5000);
    expect(downs[0].source.account).toBe('Bob.9999');
    expect(downs[0].metadata?.linkedDeathMs).toBe(7500);

    expect(deaths).toHaveLength(1);
    expect(deaths[0].timestampMs).toBe(7500);
    expect(deaths[0].metadata?.precededByDown).toBe(true);
    expect(deaths[0].metadata?.timeToDeathMs).toBe(2500);
  });

  it('emits a down event with no linked death when the player was rallied/rezzed', () => {
    const player = playerWithDownDeath('Ann', [[1000, 3000]], []); // no matching dead entry
    const report = fullReplayReport([commander, player]);
    const set = normalizeDeathEvents(report);

    expect(downEvents(set)).toHaveLength(1);
    expect(downEvents(set)[0].metadata?.linkedDeathMs).toBeNull();
    expect(deathEvents(set)).toHaveLength(0);
  });

  it('emits a death event with no preceding down for instant-execute style deaths', () => {
    const player = playerWithDownDeath('Cy', [], [[9000, 0]]);
    const report = fullReplayReport([commander, player]);
    const set = normalizeDeathEvents(report);

    expect(deathEvents(set)).toHaveLength(1);
    expect(deathEvents(set)[0].timestampMs).toBe(9000);
    expect(deathEvents(set)[0].metadata?.precededByDown).toBe(false);
  });

  it('never produces a marker event with a non-zero amount', () => {
    const player = playerWithDownDeath('Dee', [[100, 200]], [[200, 0]]);
    const report = fullReplayReport([commander, player]);
    const set = normalizeDeathEvents(report);
    expect(set.events.every((e) => e.amount === 0)).toBe(true);
  });
});

describe('timeWindow primitives', () => {
  const evt = (timestampMs: number | null, overrides: Partial<CombatEvent> = {}): CombatEvent => ({
    timestampMs,
    source: { name: 'P', account: 'P.1', kind: 'player' },
    category: 'down',
    subcategory: 'unknown',
    amount: 0,
    hits: 1,
    origin: 'eliteInsights',
    confidence: 'high',
    coverage: 'full',
    ...overrides,
  });

  const events = [evt(1000), evt(2000), evt(3000), evt(null), evt(500)];

  it('timestamped() excludes phase-aggregate (null-timestamp) events', () => {
    expect(timestamped(events)).toHaveLength(4);
  });

  it('eventsInWindow() is inclusive on both ends', () => {
    const inWindow = eventsInWindow(events, 2000, 1000);
    expect(inWindow.map((e) => e.timestampMs).sort()).toEqual([1000, 2000, 3000]);
  });

  it('eventsBetween() handles reversed bounds', () => {
    const between = eventsBetween(events, 3000, 1000);
    expect(between.map((e) => e.timestampMs).sort()).toEqual([1000, 2000, 3000]);
  });

  it('eventsBefore() sorts most-recent-first and respects limit', () => {
    const before = eventsBefore(events, 3000, 1);
    expect(before).toHaveLength(1);
    expect(before[0].timestampMs).toBe(2000);
  });

  it('eventsAfter() sorts earliest-first', () => {
    const after = eventsAfter(events, 1000);
    expect(after.map((e) => e.timestampMs)).toEqual([2000, 3000]);
  });

  it('sortByTime() places null-timestamp events last, stably', () => {
    const sorted = sortByTime(events);
    expect(sorted[sorted.length - 1].timestampMs).toBeNull();
    expect(sorted.slice(0, 4).map((e) => e.timestampMs)).toEqual([500, 1000, 2000, 3000]);
  });
});
