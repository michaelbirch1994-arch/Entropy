import { describe, expect, it } from 'vitest';
import { rankFightExtremes } from '../topSkillExtremes';

const sample = (value: number, fightIndex: number) => ({
  value,
  fightIndex,
  fightName: `Fight ${fightIndex + 1}`,
  fightLabel: `F${fightIndex + 1}`,
});

describe('rankFightExtremes', () => {
  it('returns top and bottom observed fights in deterministic order', () => {
    const result = rankFightExtremes([
      sample(500, 0),
      sample(800, 1),
      sample(300, 2),
      sample(700, 3),
      sample(400, 4),
    ]);

    expect(result.highest.map((entry) => entry.value)).toEqual([800, 700, 500]);
    expect(result.lowest.map((entry) => entry.value)).toEqual([300, 400, 500]);
  });

  it('uses fight index as the stable tie breaker', () => {
    const result = rankFightExtremes([
      sample(500, 4),
      sample(500, 1),
      sample(500, 3),
      sample(500, 0),
    ], 3);

    expect(result.highest.map((entry) => entry.fightIndex)).toEqual([0, 1, 3]);
    expect(result.lowest.map((entry) => entry.fightIndex)).toEqual([0, 1, 3]);
  });

  it('filters invalid samples rather than ranking invented values', () => {
    const result = rankFightExtremes([
      sample(Number.NaN, 0),
      sample(-1, 1),
      sample(250, 2),
      { ...sample(300, 3), fightIndex: -1 },
    ]);

    expect(result.highest).toEqual([sample(250, 2)]);
    expect(result.lowest).toEqual([sample(250, 2)]);
  });

  it('honors zero and smaller limits', () => {
    const samples = [sample(100, 0), sample(200, 1), sample(300, 2)];

    expect(rankFightExtremes(samples, 0)).toEqual({ highest: [], lowest: [] });
    expect(rankFightExtremes(samples, 2).highest.map((entry) => entry.value)).toEqual([300, 200]);
  });
});
