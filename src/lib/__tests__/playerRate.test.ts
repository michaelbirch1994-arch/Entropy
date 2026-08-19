import { describe, expect, it } from 'vitest';
import { rateByActiveMs } from '../playerRate';

describe('rateByActiveMs', () => {
  it('uses the individual player active time when converting totals to rates', () => {
    expect(rateByActiveMs(12_000, 6_000, true)).toBe(2_000);
    expect(rateByActiveMs(12_000, 12_000, true)).toBe(1_000);
  });

  it('leaves totals unchanged outside per-second mode', () => {
    expect(rateByActiveMs(12_000, 6_000, false)).toBe(12_000);
  });

  it('returns zero for missing or invalid denominators instead of Infinity/NaN', () => {
    expect(rateByActiveMs(12_000, 0, true)).toBe(0);
    expect(rateByActiveMs(12_000, undefined, true)).toBe(0);
    expect(rateByActiveMs(Number.NaN, 6_000, true)).toBe(0);
  });
});
