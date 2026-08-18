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
 * New reports use the account-level GeneralPlayer row. Older reports can still
 * supply a view-specific fallback without pretending missing coverage is zero.
 */
export function resolvePlayerSampleContext(
  rows: PlayerSampleSource[] | undefined,
  totalFights: number,
  account: string,
  fallback: PlayerSampleFallback = {},
): PlayerSampleContextData {
  const source = rows?.find((row) => row.account === account);
  const hasFallbackFights = Number.isFinite(fallback.fights);
  const known = Boolean(source) || hasFallbackFights;
  const fights = Math.floor(safeNonNegative(source?.logsJoined ?? fallback.fights));
  const safeTotal = Math.max(fights, Math.floor(safeNonNegative(totalFights)));
  const activeMs = safeNonNegative(
    source?.squadActiveMs
      || source?.totalFightMs
      || fallback.activeMs,
  );

  return {
    fights,
    totalFights: safeTotal,
    activeMs,
    known,
  };
}
