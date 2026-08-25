export interface PlayerSampleSource {
  account: string;
  logsJoined?: number;
  squadActiveMs?: number;
  totalFightMs?: number;
}

export interface PlayerSampleFallback {
  fights?: number;
  activeMs?: number;
}

export interface PlayerSampleContextData {
  fights: number;
  totalFights: number;
  activeMs: number;
  known: boolean;
}

function safeNonNegative(value: number | undefined): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

/**
 * Resolves one consistent participation/sample description for player tables.
 * New reports use one account-level GeneralPlayer row. Older saved reports can
 * still contain one row per profession after a build swap, so combine every
 * matching slice instead of silently keeping the first one.
 */
export function resolvePlayerSampleContext(
  rows: PlayerSampleSource[] | undefined,
  totalFights: number,
  account: string,
  fallback: PlayerSampleFallback = {},
): PlayerSampleContextData {
  const sources = rows?.filter((row) => row.account === account) ?? [];
  const hasSource = sources.length > 0;
  const hasSourceFights = sources.some((row) => Number.isFinite(row.logsJoined));
  const hasFallbackFights = Number.isFinite(fallback.fights);
  const known = hasSource || hasFallbackFights;
  const safeTotal = Math.floor(safeNonNegative(totalFights));

  const sourceFights = sources.reduce((sum, row) => sum + safeNonNegative(row.logsJoined), 0);
  const fights = hasSourceFights
    ? Math.min(safeTotal, Math.floor(sourceFights))
    : Math.min(safeTotal, Math.floor(safeNonNegative(fallback.fights)));

  const sourceActiveMs = sources.reduce((sum, row) => {
    const squadActiveMs = safeNonNegative(row.squadActiveMs);
    return sum + (squadActiveMs > 0 ? squadActiveMs : safeNonNegative(row.totalFightMs));
  }, 0);
  const activeMs = sourceActiveMs > 0 ? sourceActiveMs : safeNonNegative(fallback.activeMs);

  return {
    fights,
    totalFights: safeTotal,
    activeMs,
    known,
  };
}
