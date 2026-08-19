import {
  computeBoonMetrics,
  getBoonMetricValue,
  type BoonCategory,
  type BoonRow,
} from './bridge-metrics/boonGeneration';

/**
 * Return the generated effect-time represented by a Buff Generation row.
 *
 * For duration-stacking buffs this is ordinary boon-duration seconds. For
 * intensity-stacking buffs (for example Might or Stability) this is stack-time:
 * one stack held for one second contributes one stack-second. The numeric value is
 * intentionally shared because both forms come from the same normalized
 * generationMs field; presentation must label the unit honestly.
 */
export const getGeneratedSeconds = (
  row: BoonRow,
  category: BoonCategory,
  stacking: boolean,
) => getBoonMetricValue(row, category, stacking, 'total');

/**
 * EI exports `Wasted` as a phase-normalized wasted-generation value. Entropy's
 * normalization reverses that phase/player normalization into `wastedMs`, so this
 * is actual wasted/reapplied duration for duration buffs and wasted/reapplied
 * stack-time for intensity buffs, expressed in seconds or stack-seconds.
 *
 * This is intentionally separate from EI's `Overstack` field. EI's current parser
 * builds `Overstack` from (raw overstack + generation), so that exported field is
 * not a pure overcap-duration value and must not be labeled as such here.
 */
export const getWastedSeconds = (
  row: BoonRow,
  category: BoonCategory,
  stacking: boolean,
) => computeBoonMetrics(row, category, stacking).wastedMs / 1000;

/** Human-readable unit label for a normalized generation total. */
export const generatedUnitLabel = (stacking: boolean) => stacking ? 'stack-seconds' : 'seconds';

/**
 * Compact human-readable wall-clock duration for duration-stacking effects.
 * Values under one minute stay in seconds; longer values are shown as
 * hours/minutes/seconds without throwing away precision in the data model.
 */
export const formatGeneratedDuration = (seconds: number) => {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const rounded = Math.round(safeSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

/**
 * Format generated effect-time without pretending intensity stack-time is
 * wall-clock duration. Duration buffs keep the compact h/m/s format; intensity
 * buffs are rendered as an explicit stack-second count.
 */
export const formatGeneratedEffect = (seconds: number, stacking: boolean) => {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  if (!stacking) return formatGeneratedDuration(safeSeconds);
  return `${Math.round(safeSeconds).toLocaleString()} stack-s`;
};
