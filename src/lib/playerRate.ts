/**
 * Convert a player total into a per-second rate using that player's own tracked
 * active/fight time. Keeping this in the data/analytics layer prevents table
 * components from drifting into different denominator rules.
 */
export function rateByActiveMs(value: number, activeMs: number | undefined, perSecond: boolean): number {
  const safeValue = Number.isFinite(value) ? value : 0;
  if (!perSecond) return safeValue;
  const seconds = Math.max(0, Number(activeMs) || 0) / 1000;
  return seconds > 0 ? safeValue / seconds : 0;
}
