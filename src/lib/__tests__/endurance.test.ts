import { describe, expect, it } from 'vitest';
import { enduranceScenario, buildEnduranceEvidence } from '../insight/endurance';
import type { WvWReport } from '../../types/report';

describe('Conditional endurance scenario', () => {
  it('integrates effect changes and caps endurance', () => {
    expect(enduranceScenario(0, 10000, [[0, 0]], [[0, 0]])).toMatchObject({ lower: 50, upper: 100 });
    expect(enduranceScenario(0, 10000, [[0, 1], [5000, 0]], [[0, 0]])).toMatchObject({ lower: 62.5, upper: 100 });
    expect(enduranceScenario(0, 10000, [[0, 0]], [[0, 1]])).toMatchObject({ lower: 25, upper: 75 });
  });
  it('preserves missing states and overlap as uncertainty', () => {
    expect(enduranceScenario(0, 1000, [], [])).toEqual({ lower: 2.5, upper: 57.5, uncertainEffectTimeMs: 1000 });
    expect(enduranceScenario(0, 1000, [[0, 1]], [[0, 1]])).toMatchObject({ uncertainEffectTimeMs: 1000 });
  });
  it('does not infer endurance from aggregate dodge counts or unsupported mechanics', () => {
    const report = { stats: { replayFights: [{ fightId: 'f', data: { durationMs: 20000, players: [{ account: 'A', profession: 'Vindicator', downIntervals: [[10000, 15000]] }] } }] } } as unknown as WvWReport;
    const before = JSON.stringify(report);
    expect(buildEnduranceEvidence(report, 'A')[0].data).toMatchObject({ actualDodgeAvailability: 'Unknown', scenario: null });
    expect(JSON.stringify(report)).toBe(before);
  });
});
