import type { LeaderboardEntry, ReportStats } from "../types/report";
import {
  buildNormalizedTopPlayerSources,
  normalizeTopPlayersLeaderboard,
  type NormalizedTopPlayerSources,
} from "./topPlayersNormalization";

/**
 * Expanded Top Players cards read Stability and Dodges from saved leaderboards
 * rather than the normalized offense/support/defense source rows. Older reports
 * can contain one leaderboard entry per profession, so normalize just those two
 * source-only metrics before the cards look up the account value.
 */
export function buildNormalizedTopPlayerSourceLeaderboards(
  stats: ReportStats,
  normalizedSources: Map<string, NormalizedTopPlayerSources> = buildNormalizedTopPlayerSources(stats),
): Record<string, LeaderboardEntry[]> {
  return {
    ...(stats.leaderboards ?? {}),
    stability: normalizeTopPlayersLeaderboard(stats, "stability", normalizedSources),
    dodges: normalizeTopPlayersLeaderboard(stats, "dodges", normalizedSources),
  };
}
