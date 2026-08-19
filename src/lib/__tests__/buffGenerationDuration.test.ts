import { describe, expect, it } from 'vitest';
import { formatGeneratedDuration, getGeneratedSeconds } from '../buffGenerationDuration';
import type { BoonRow } from '../bridge-metrics/boonGeneration';

const row: BoonRow = {
  account: 'Tester.1234',
  profession: 'Guardian',
  activeTimeMs: 120_000,
  numFights: 1,
  groupSupported: 5,
  squadSupported: 10,
  categories: {
    selfBuffs: { generationMs: 12_500, wastedMs: 0, overstackMs: 0 },
    groupBuffs: { generationMs: 65_000, wastedMs: 0, overstackMs: 0 },
    squadBuffs: { generationMs: 154_000, wastedMs: 0, overstackMs: 0 },
  },
};

describe('Buff Generation duration display', () => {
  it('reads generated duration directly from normalized generationMs', () => {
    expect(getGeneratedSeconds(row, 'selfBuffs', false)).toBe(12.5);
    expect(getGeneratedSeconds(row, 'groupBuffs', false)).toBe(65);
    expect(getGeneratedSeconds(row, 'squadBuffs', false)).toBe(154);
  });

  it('formats seconds compactly', () => {
    expect(formatGeneratedDuration(12.4)).toBe('12s');
    expect(formatGeneratedDuration(154)).toBe('2m 34s');
    expect(formatGeneratedDuration(3_725)).toBe('1h 2m 5s');
  });

  it('handles invalid or negative values safely', () => {
    expect(formatGeneratedDuration(Number.NaN)).toBe('0s');
    expect(formatGeneratedDuration(-10)).toBe('0s');
  });
});
