import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  normalizeBoonLossEvents,
  boonLossEvents,
  stabilityLossEvents,
  aegisLossEvents,
} from '../combat/normalizeBoonLoss';
import type { ParsedReport } from '../bridge-metrics/positioning';

function playerWithBoonStates(
  name: string,
  buffUptimes: Array<{ id: number; states?: Array<[number, number]> }>,
  overrides: Record<string, unknown> = {},
) {
  return {
    name,
    account: `${name}.1`,
    profession: 'Guardian',
    notInSquad: false,
    buffUptimes,
    ...overrides,
  };
}

function reportOf(players: unknown[]): ParsedReport {
  return { details: { players } } as unknown as ParsedReport;
}

const STABILITY_BOON_ID = 1122;
const AEGIS_BOON_ID = 743;

describe('normalizeBoonLossEvents (synthetic)', () => {
  it('emits a loss event when Stability stacks drop from >0 to 0', () => {
    const players = [
      playerWithBoonStates('Alice', [
        { id: STABILITY_BOON_ID, states: [[0, 1], [5000, 2], [8000, 0]] },
      ]),
    ];
    const set = normalizeBoonLossEvents(reportOf(players));

    expect(set.confidence).toBe('medium');
    const events = boonLossEvents(set);
    expect(events).toHaveLength(1);
    expect(events[0].timestampMs).toBe(8000);
    expect(events[0].subcategory).toBe('stabilityLoss');
    expect(events[0].source.account).toBe('Alice.1');
  });

  it('does not emit a loss for the initial state or for gains', () => {
    const players = [
      playerWithBoonStates('Alice', [
        { id: STABILITY_BOON_ID, states: [[0, 0], [3000, 1], [6000, 2]] },
      ]),
    ];
    const set = normalizeBoonLossEvents(reportOf(players));

    expect(boonLossEvents(set)).toHaveLength(0);
  });

  it('tracks Stability and Aegis independently per player', () => {
    const players = [
      playerWithBoonStates('Alice', [
        { id: STABILITY_BOON_ID, states: [[0, 1], [4000, 0]] },
        { id: AEGIS_BOON_ID, states: [[0, 1], [6000, 0]] },
      ]),
    ];
    const set = normalizeBoonLossEvents(reportOf(players));

    expect(stabilityLossEvents(set)).toHaveLength(1);
    expect(stabilityLossEvents(set)[0].timestampMs).toBe(4000);
    expect(aegisLossEvents(set)).toHaveLength(1);
    expect(aegisLossEvents(set)[0].timestampMs).toBe(6000);
  });

  it('handles multiple squad players independently', () => {
    const players = [
      playerWithBoonStates('Alice', [{ id: STABILITY_BOON_ID, states: [[0, 1], [1000, 0]] }]),
      playerWithBoonStates('Bob', [{ id: STABILITY_BOON_ID, states: [[0, 1], [2000, 0]] }]),
    ];
    const set = normalizeBoonLossEvents(reportOf(players));

    const events = boonLossEvents(set);
    expect(events).toHaveLength(2);
    const alice = events.find((e) => e.source.account === 'Alice.1');
    const bob = events.find((e) => e.source.account === 'Bob.1');
    expect(alice?.timestampMs).toBe(1000);
    expect(bob?.timestampMs).toBe(2000);
  });

  it('excludes players not in the squad', () => {
    const players = [
      playerWithBoonStates('Alice', [{ id: STABILITY_BOON_ID, states: [[0, 1], [1000, 0]] }]),
      playerWithBoonStates(
        'Enemy Ally',
        [{ id: STABILITY_BOON_ID, states: [[0, 1], [1000, 0]] }],
        { notInSquad: true },
      ),
    ];
    const set = normalizeBoonLossEvents(reportOf(players));

    expect(boonLossEvents(set).every((e) => e.source.account === 'Alice.1')).toBe(true);
  });

  it('returns confidence none and an explanatory note when no squad player has state data', () => {
    const players = [playerWithBoonStates('Alice', [{ id: STABILITY_BOON_ID }])];
    const set = normalizeBoonLossEvents(reportOf(players));

    expect(set.confidence).toBe('none');
    expect(set.events).toHaveLength(0);
    expect(set.note).toMatch(/buffUptimes\[\]\.states/);
  });

  it('ignores untracked boons even if they have state data', () => {
    const players = [playerWithBoonStates('Alice', [{ id: 999, states: [[0, 1], [1000, 0]] }])];
    const set = normalizeBoonLossEvents(reportOf(players));

    expect(set.confidence).toBe('none');
    expect(set.events).toHaveLength(0);
  });
});

describe('normalizeBoonLossEvents against the real fixture', () => {
  it('honestly reports zero events because the raw Elite Insights export has no buffUptimes state data (documented, not a bug)', () => {
    const raw = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'wvw-modern-ei.json'), 'utf-8'));
    const report: ParsedReport = { details: raw } as unknown as ParsedReport;
    const set = normalizeBoonLossEvents(report);

    expect(set.confidence).toBe('none');
    expect(set.events).toHaveLength(0);
    expect(set.note).toMatch(/buffUptimes\[\]\.states/);
  });
});
