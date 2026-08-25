import type { LeaderboardEntry, ReportStats } from "../types/report";
import {
  buildNormalizedTopPlayerSources,
  normalizeTopPlayersLeaderboard,
  type NormalizedTopPlayerSources,
  type TopPlayersMetricKey,
} from "./topPlayersNormalization";

export interface DiscordReportLeaders {
  damage?: LeaderboardEntry;
  downContrib?: LeaderboardEntry;
  healing?: LeaderboardEntry;
  strips?: LeaderboardEntry;
}

function normalizedSavedLeader(
  stats: ReportStats,
  metric: TopPlayersMetricKey,
  aliases: string[],
  normalizedSources: Map<string, NormalizedTopPlayerSources>,
): LeaderboardEntry | undefined {
  const leaderboards = stats.leaderboards ?? {};
  const sourceRows = [metric, ...aliases]
    .map((key) => leaderboards[key])
    .find((rows) => Array.isArray(rows) && rows.length > 0);
  if (!sourceRows) return undefined;

  const statsForMetric = leaderboards[metric] === sourceRows
    ? stats
    : {
        ...stats,
        leaderboards: {
          ...leaderboards,
          [metric]: sourceRows,
        },
      };

  return normalizeTopPlayersLeaderboard(statsForMetric, metric, normalizedSources)[0];
}

function fallbackSourceLeader(
  metric: TopPlayersMetricKey,
  normalizedSources: Map<string, NormalizedTopPlayerSources>,
): LeaderboardEntry | undefined {
  const entries: Omit<LeaderboardEntry, "rank">[] = [];

  for (const [account, sources] of normalizedSources) {
    const primary = sources.general ?? sources.offense ?? sources.healing ?? sources.support ?? sources.defense;
    if (!primary) continue;

    let value = 0;
    if (metric === "damage") value = sources.offense?.offenseTotals.damage ?? 0;
    else if (metric === "downContrib") value = sources.offense?.offenseTotals.downContribution ?? 0;
    else if (metric === "healing") value = sources.healing?.healingTotals.healing ?? 0;
    else if (metric === "strips") value = sources.support?.supportTotals.boonStrips ?? 0;
    else continue;

    if (!Number.isFinite(value) || value <= 0) continue;
    entries.push({
      account,
      profession: primary.profession,
      professionList: primary.professionList ?? [],
      value,
      count: Math.min(
        stats.total,
        sources.general?.logsJoined ?? sources.support?.logsJoined ?? 0,
      ),
    });
  }

  return entries
    .sort((a, b) => b.value - a.value || a.account.localeCompare(b.account))
    .map((entry, index) => ({ ...entry, rank: index + 1 }))[0];
}

export function resolveDiscordReportLeaders(stats: ReportStats): DiscordReportLeaders {
  const normalizedSources = buildNormalizedTopPlayerSources(stats);
  const resolve = (metric: TopPlayersMetricKey, aliases: string[] = []) =>
    normalizedSavedLeader(stats, metric, aliases, normalizedSources)
      ?? fallbackSourceLeader(metric, normalizedSources);

  return {
    damage: resolve("damage", ["damageAll"]),
    downContrib: resolve("downContrib", ["downContribution"]),
    healing: resolve("healing"),
    strips: resolve("strips", ["boonStrips"]),
  };
}
