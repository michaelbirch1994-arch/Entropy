import { getBoonMetricValue, type BoonCategory, type BoonRow } from './bridge-metrics/boonGeneration';

/**
 * Return the actual generated boon-duration represented by a Buff Generation row.
 *
 * Buffs / Party Boons already answer the uptime-percentage question. Buff Generation
 * should instead answer "how much duration did this player create?". The normalized
 * boon-generation layer stores this as generationMs and exposes it through the
 * `total` metric in seconds, so the presentation layer does not need to reconstruct
 * duration from percentages.
 */
export const getGeneratedSeconds = (
  row: BoonRow,
  category: BoonCategory,
  stacking: boolean,
) => getBoonMetricValue(row, category, stacking, 'total');

/**
 * Compact human-readable duration while keeping the numeric seconds available for
 * sorting and tooltips. Values under one minute stay in seconds; longer values are
 * shown as hours/minutes/seconds without throwing away precision in the data model.
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
