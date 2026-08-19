import { describe, expect, it } from 'vitest';
import {
  formatGeneratedDuration,
  formatGeneratedEffect,
  generatedUnitLabel,
  getGeneratedSeconds,
  getWastedSeconds,
} from '../buffGenerationDuration';
import type { BoonRow } from '../bridge-metrics/boonGeneration';

const row: BoonRow = {
  account: 'Tester.1234',
  profession: 'Guardian',
  activeTimeMs: 120_000,
  numFights: 1,
  groupSupported: 5,
  squadSupported: 10,
  categories: {
    selfBuffs: { generationMs: 12_500, wastedMs: 2_500, overstackMs: 0 },
    groupBuffs: { generationMs: 65_000, wastedMs: 8_000, overstackMs: 0 },
    squadBuffs: { generationMs: 154_000, wastedMs: 23_500, overstackMs: 0 },
  },
};

describe('Buff Generation duration display', () => {
  it('reads generated duration directly from normalized generationMs', () => {
    expect(getGeneratedSeconds(row, 'selfBuffs', false)).toBe(12.5);
    expect(getGeneratedSeconds(row, 'groupBuffs', false)).toBe(65);
    expect(getGeneratedSeconds(row, 'squadBuffs', false)).toBe(154);
  });

  it('reads wasted duration directly from normalized wastedMs', () => {
    expect(getWastedSeconds(row, 'selfBuffs', false)).toBe(2.5);
    expect(getWastedSeconds(row, 'groupBuffs', false)).toBe(8);
    expect(getWastedSeconds(row, 'squadBuffs', false)).toBe(23.5);
  });

  it('formats duration-stacking boon seconds compactly', () => {
    expect(formatGeneratedDuration(12.4)).toBe('12s');
    expect(formatGeneratedDuration(154)).toBe('2m 34s');
    expect(formatGeneratedDuration(3_725)).toBe('1h 2m 5s');
    expect(formatGeneratedEffect(154, false)).toBe('2m 34s');
    expect(generatedUnitLabel(false)).toBe('seconds');
  });

  it('labels intensity-stacking totals as stack-seconds rather than wall-clock duration', () => {
    expect(formatGeneratedEffect(154, true)).toBe('154 stack-s');
    expect(formatGeneratedEffect(3_725, true)).toBe('3,725 stack-s');
    expect(generatedUnitLabel(true)).toBe('stack-seconds');
  });

  it('handles invalid or negative values safely', () => {
    expect(formatGeneratedDuration(Number.NaN)).toBe('0s');
    expect(formatGeneratedDuration(-10)).toBe('0s');
    expect(formatGeneratedEffect(Number.NaN, true)).toBe('0 stack-s');
    expect(formatGeneratedEffect(-10, true)).toBe('0 stack-s');
  });
});
