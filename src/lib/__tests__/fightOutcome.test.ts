import { describe, expect, it } from 'vitest';
import { getFightOutcome, isWvWFight } from '../bridge-metrics/computePlayerAggregation';

describe('fight outcome evidence policy', () => {
  it('recognizes WvW from the canonical map id', () => {
    expect(isWvWFight({ mapID: 95 })).toBe(true);
    expect(isWvWFight({ mapID: 96 })).toBe(true);
    expect(isWvWFight({ mapID: 38 })).toBe(true);
    expect(isWvWFight({ mapID: 1099 })).toBe(true);
  });

  it('recognizes WvW metadata and common map labels', () => {
    expect(isWvWFight({ wvwMapData: { objectives: [] } })).toBe(true);
    expect(isWvWFight({ fightName: 'Detailed WvW - Blue Alpine Borderlands' })).toBe(true);
    expect(isWvWFight({ fightName: 'Eternal Battlegrounds' })).toBe(true);
  });

  it('does not turn favorable WvW trades into a claimed win', () => {
    const fight = {
      mapID: 96,
      success: true,
      players: [
        {
          notInSquad: false,
          defenses: [{ downCount: 1, deadCount: 1 }],
          statsTargets: [[{ downed: 15, killed: 12 }]],
        },
      ],
    };

    expect(getFightOutcome(fight)).toBeNull();
  });

  it('does not turn unfavorable WvW trades into a claimed loss', () => {
    const fight = {
      mapID: 95,
      success: false,
      players: [
        {
          notInSquad: false,
          defenses: [{ downCount: 8, deadCount: 6 }],
          statsTargets: [[{ downed: 2, killed: 1 }]],
        },
      ],
    };

    expect(getFightOutcome(fight)).toBeNull();
  });

  it('preserves an explicit non-WvW success flag', () => {
    expect(getFightOutcome({ mapID: 15, success: true })).toBe(true);
    expect(getFightOutcome({ mapID: 15, success: false })).toBe(false);
  });

  it('leaves source-less outcomes unclassified', () => {
    expect(getFightOutcome({ mapID: 15 })).toBeNull();
  });
});
