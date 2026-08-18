import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { detectSquadSeparations } from '../intelligence/squadSeparation';
import { normalizeDeathEvents } from '../combat/normalizeDeaths';
import type { ParsedReport } from '../bridge-metrics/positioning';
import type { CombatEvent, CombatEventSet } from '../combat/CombatEvent';

function fullReplayReport(players: any[], overrides: Partial<ParsedReport['details']> = {}): ParsedReport {
  return {
    details: {
      players,
      combatReplayMetaData: { pollingRate: 1000, inchToPixel: 1, sizes: [1000, 1000] },
      durationMS: 10000,
      ...overrides,
    },
  } as ParsedReport;
}

const commander = {
  name: 'Tag',
  account: 'Tag.1234',
  hasCommanderTag: true,
  combatReplayData: { positions: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], start: 0 },
};

function player(
  name: string,
  positions: Array<[number, number]>,
  overrides: Record<string, unknown> = {},
) {
  return {
    name,
    account: `${name}.9999`,
    profession: 'Guardian',
    notInSquad: false,
    combatReplayData: { positions, start: 0, down: [], dead: [] },
    ...overrides,
  };
}

const downOrDeath = (timestampMs: number, sourceName: string, category: 'down' | 'death'): CombatEvent => ({
  timestampMs,
  source: { name: sourceName, account: `${sourceName}.9999`, kind: 'player', side: 'friendly' },
  category,
  subcategory: 'unknown',
  amount: 0,
  hits: 1,
  origin: 'eliteInsights',
  confidence: 'high',
  coverage: 'full',
});

const eventSet = (events: CombatEvent[], confidence: CombatEventSet['confidence'] = 'high'): CombatEventSet => ({
  events,
  origin: 'eliteInsights',
  confidence,
  unattributed: 0,
});

describe('detectSquadSeparations', () => {
  it('detects one player separated from commander for a sustained window', () => {
    const report = fullReplayReport([
      commander,
      player('Alice', [[0, 0], [1300, 0], [1300, 0], [1300, 0], [0, 0], [0, 0]]),
    ]);

    const events = detectSquadSeparations(report, 'fight-1', undefined, {
      distanceThreshold: 1200,
      minDurationMs: 3000,
    });

    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('squad-separation');
    expect(events[0].category).toBe('positioning');
    expect(events[0].timestampMs).toBe(1000);
    expect(events[0].relatedPlayers).toEqual(['player:Alice.9999']);
    expect(events[0].summary).toMatch(/3.0s/);
    expect(events[0].summary).toMatch(/peak 1300/);
  });

  it('ignores separation shorter than the minimum duration', () => {
    const report = fullReplayReport([
      commander,
      player('Alice', [[0, 0], [1300, 0], [1300, 0], [0, 0], [0, 0], [0, 0]]),
    ]);

    const events = detectSquadSeparations(report, 'fight-1', undefined, {
      distanceThreshold: 1200,
      minDurationMs: 3000,
    });

    expect(events).toHaveLength(0);
  });

  it('ignores players below the distance threshold', () => {
    const report = fullReplayReport([
      commander,
      player('Alice', [[0, 0], [1000, 0], [1000, 0], [1000, 0], [0, 0], [0, 0]]),
    ]);

    const events = detectSquadSeparations(report, 'fight-1', undefined, {
      distanceThreshold: 1200,
      minDurationMs: 3000,
    });

    expect(events).toHaveLength(0);
  });

  it('links same-player down/death events near the separation window', () => {
    const report = fullReplayReport([
      commander,
      player('Alice', [[0, 0], [1300, 0], [1300, 0], [1300, 0], [0, 0], [0, 0]]),
    ]);
    const downDeaths = eventSet([downOrDeath(3500, 'Alice', 'down')]);

    const events = detectSquadSeparations(report, 'fight-1', downDeaths, {
      distanceThreshold: 1200,
      minDurationMs: 3000,
      downDeathLookaroundMs: 3000,
    });

    expect(events).toHaveLength(1);
    expect(events[0].relatedEvents).toHaveLength(1);
    expect(events[0].summary).toMatch(/1 linked down\/death event/);
  });

  it('does not link another player down/death event as evidence', () => {
    const report = fullReplayReport([
      commander,
      player('Alice', [[0, 0], [1300, 0], [1300, 0], [1300, 0], [0, 0], [0, 0]]),
      player('Bob', [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]),
    ]);
    const downDeaths = eventSet([downOrDeath(3500, 'Bob', 'down')]);

    const events = detectSquadSeparations(report, 'fight-1', downDeaths, {
      distanceThreshold: 1200,
      minDurationMs: 3000,
      downDeathLookaroundMs: 3000,
    });

    expect(events).toHaveLength(1);
    expect(events[0].relatedEvents).toHaveLength(0);
  });

  it('returns nothing when replay degree is coarse or none', () => {
    const coarse: ParsedReport = {
      details: {
        players: [{ name: 'Alice', account: 'Alice.9999', statsAll: [{ distToCom: 2000 }] }],
      },
    };
    const none: ParsedReport = { details: { players: [{ name: 'Alice', account: 'Alice.9999' }] } };

    expect(detectSquadSeparations(coarse, 'fight-1')).toHaveLength(0);
    expect(detectSquadSeparations(none, 'fight-1')).toHaveLength(0);
  });

  it('handles real normalizeDeathEvents output as related down/death evidence', () => {
    const alice = player(
      'Alice',
      [[0, 0], [1300, 0], [1300, 0], [1300, 0], [0, 0], [0, 0]],
      { combatReplayData: { positions: [[0, 0], [1300, 0], [1300, 0], [1300, 0], [0, 0], [0, 0]], start: 0, down: [[3000, 5000]], dead: [[5000, 0]] } },
    );
    const report = fullReplayReport([commander, alice]);
    const downDeaths = normalizeDeathEvents(report);

    const events = detectSquadSeparations(report, 'fight-1', downDeaths, {
      distanceThreshold: 1200,
      minDurationMs: 3000,
      downDeathLookaroundMs: 3000,
    });

    expect(events).toHaveLength(1);
    expect(events[0].relatedEvents.length).toBeGreaterThanOrEqual(1);
  });
});

describe('detectSquadSeparations against the real fixture', () => {
  it('honestly reports zero events because wvw-modern-ei.json lacks full replay data', () => {
    const raw = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'wvw-modern-ei.json'), 'utf-8'));
    const report: ParsedReport = { details: raw };

    expect(detectSquadSeparations(report, 'real-fight')).toHaveLength(0);
  });
});
