import type {
  DefensePlayer,
  GeneralPlayer,
  HealingCoverage,
  HealingPlayer,
  HealingTotals,
  LeaderboardEntry,
  OffensePlayer,
  OffenseTotals,
  PlayerSkillBreakdown,
  ReportStats,
  SupportPlayer,
  SupportTotals,
} from "../types/report";

export type TopPlayersMetricKey =
  | "dps"
  | "damage"
  | "downContrib"
  | "healing"
  | "barrier"
  | "cleanses"
  | "strips"
  | "stability"
  | "cc"
  | "interrupts"
  | "dodges"
  | "kills";

export interface NormalizedTopPlayerSources {
  offense?: OffensePlayer;
  healing?: HealingPlayer;
  support?: SupportPlayer;
  defense?: DefensePlayer;
  general?: GeneralPlayer;
}

function groupByAccount<T extends { account: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const current = grouped.get(row.account) ?? [];
    current.push(row);
    grouped.set(row.account, current);
  }
  return grouped;
}

function sumNumericRecords<T extends object>(rows: T[]): T {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    for (const [key, raw] of Object.entries(row)) {
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      totals[key] = (totals[key] ?? 0) + value;
    }
  }
  return totals as T;
}

function professionListFor(rows: Array<{ profession?: string; professionList?: string[] }>): string[] {
  return Array.from(new Set(rows.flatMap((row) => [row.profession, ...(row.professionList ?? [])]).filter((value): value is string => !!value)));
}

function healingCoverageFor(player: HealingPlayer): HealingCoverage {
  if (player.healingCoverage) return player.healingCoverage;
  if (player.hasHealAddon) return "full";
  return (player.healingTotals.healing ?? 0) > 0 ? "partial" : "none";
}

function mergeOffense(rows: OffensePlayer[]): OffensePlayer | undefined {
  if (!rows.length) return undefined;
  const primary = [...rows].sort((a, b) => (b.totalFightMs ?? 0) - (a.totalFightMs ?? 0))[0];
  return {
    account: primary.account,
    profession: primary.profession,
    professionList: professionListFor(rows),
    offenseTotals: sumNumericRecords(rows.map((row) => row.offenseTotals)) as OffenseTotals,
    offenseRateWeights: sumNumericRecords(rows.map((row) => row.offenseRateWeights)),
    totalFightMs: rows.reduce((sum, row) => sum + (row.totalFightMs ?? 0), 0),
  };
}

function mergeHealing(rows: HealingPlayer[]): HealingPlayer | undefined {
  if (!rows.length) return undefined;
  const primary = [...rows].sort((a, b) => (b.activeMs ?? 0) - (a.activeMs ?? 0))[0];
  const healingTotals = sumNumericRecords(rows.map((row) => row.healingTotals)) as HealingTotals;
  const coverages = rows.map(healingCoverageFor);
  const hasObservedHealing = (healingTotals.healing ?? 0) > 0;
  const healingCoverage: HealingCoverage = coverages.every((coverage) => coverage === "full")
    ? "full"
    : hasObservedHealing
      ? "partial"
      : "none";
  return {
    account: primary.account,
    profession: primary.profession,
    professionList: professionListFor(rows),
    healingTotals,
    activeMs: rows.reduce((sum, row) => sum + (row.activeMs ?? 0), 0),
    hasHealAddon: healingCoverage === "full",
    healingCoverage,
  };
}

function mergeSupport(rows: SupportPlayer[], totalFights: number): SupportPlayer | undefined {
  if (!rows.length) return undefined;
  const primary = [...rows].sort((a, b) => (b.activeMs ?? 0) - (a.activeMs ?? 0))[0];
  return {
    account: primary.account,
    profession: primary.profession,
    professionList: professionListFor(rows),
    supportTotals: sumNumericRecords(rows.map((row) => row.supportTotals)) as SupportTotals,
    activeMs: rows.reduce((sum, row) => sum + (row.activeMs ?? 0), 0),
    logsJoined: Math.min(totalFights, rows.reduce((sum, row) => sum + (row.logsJoined ?? 0), 0)),
  };
}

function mergeDefense(rows: DefensePlayer[]): DefensePlayer | undefined {
  if (!rows.length) return undefined;
  const primary = [...rows].sort((a, b) => (b.totalFightMs ?? 0) - (a.totalFightMs ?? 0))[0];
  return {
    account: primary.account,
    profession: primary.profession,
    professionList: professionListFor(rows),
    defenseTotals: sumNumericRecords(rows.map((row) => row.defenseTotals)),
    totalFightMs: rows.reduce((sum, row) => sum + (row.totalFightMs ?? 0), 0),
  };
}

function mergeGeneral(rows: GeneralPlayer[], totalFights: number): GeneralPlayer | undefined {
  if (!rows.length) return undefined;
  const primary = [...rows].sort((a, b) => (b.totalFightMs ?? 0) - (a.totalFightMs ?? 0))[0];
  return {
    account: primary.account,
    profession: primary.profession,
    professionList: professionListFor(rows),
    totalFightMs: rows.reduce((sum, row) => sum + (row.totalFightMs ?? 0), 0),
    squadActiveMs: rows.reduce((sum, row) => sum + (row.squadActiveMs ?? 0), 0),
    totalDist: rows.reduce((sum, row) => sum + (row.totalDist ?? 0), 0),
    distCount: rows.reduce((sum, row) => sum + (row.distCount ?? 0), 0),
    logsJoined: Math.min(totalFights, rows.reduce((sum, row) => sum + (row.logsJoined ?? 0), 0)),
    stackedLogCount: rows.reduce((sum, row) => sum + (row.stackedLogCount ?? 0), 0),
  };
}

export function buildNormalizedTopPlayerSources(stats: ReportStats): Map<string, NormalizedTopPlayerSources> {
  const offense = groupByAccount(stats.offensePlayers ?? []);
  const healing = groupByAccount(stats.healingPlayers ?? []);
  const support = groupByAccount(stats.supportPlayers ?? []);
  const defense = groupByAccount(stats.defensePlayers ?? []);
  const general = groupByAccount(stats.generalPlayers ?? []);
  const accounts = new Set([
    ...offense.keys(),
    ...healing.keys(),
    ...support.keys(),
    ...defense.keys(),
    ...general.keys(),
  ]);
  const result = new Map<string, NormalizedTopPlayerSources>();
  for (const account of accounts) {
    result.set(account, {
      offense: mergeOffense(offense.get(account) ?? []),
      healing: mergeHealing(healing.get(account) ?? []),
      support: mergeSupport(support.get(account) ?? [], stats.total),
      defense: mergeDefense(defense.get(account) ?? []),
      general: mergeGeneral(general.get(account) ?? [], stats.total),
    });
  }
  return result;
}

function rankLeaderboard(entries: Omit<LeaderboardEntry, "rank">[]): LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => b.value - a.value || a.account.localeCompare(b.account));
  let previousValue: number | null = null;
  let rank = 0;
  return sorted.map((entry, index) => {
    if (previousValue === null || entry.value !== previousValue) {
      rank = index + 1;
      previousValue = entry.value;
    }
    return { ...entry, rank };
  });
}

export function normalizeTopPlayersLeaderboard(
  stats: ReportStats,
  metric: TopPlayersMetricKey,
  normalizedSources = buildNormalizedTopPlayerSources(stats),
): LeaderboardEntry[] {
  const grouped = groupByAccount(stats.leaderboards?.[metric] ?? []);
  const entries: Omit<LeaderboardEntry, "rank">[] = [];

  for (const [account, rows] of grouped) {
    const sources = normalizedSources.get(account);
    const sourcePrimary = sources?.general ?? sources?.offense;
    const first = rows[0];
    const professionList = Array.from(new Set([
      ...(sourcePrimary?.professionList ?? []),
      ...rows.flatMap((row) => [row.profession, ...(row.professionList ?? [])]),
    ].filter(Boolean)));
    const value = metric === "dps" && sources?.offense
      ? (sources.offense.totalFightMs > 0
        ? (sources.offense.offenseTotals.damage ?? 0) / (sources.offense.totalFightMs / 1000)
        : 0)
      : rows.reduce((sum, row) => sum + (Number(row.value) || 0), 0);
    if (!Number.isFinite(value) || value <= 0) continue;
    entries.push({
      account,
      profession: sourcePrimary?.profession ?? first?.profession ?? "Unknown",
      professionList,
      value,
      count: Math.min(stats.total, rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0)),
    });
  }

  return rankLeaderboard(entries);
}

type SkillSource = PlayerSkillBreakdown["damage"][number];

function mergeSkillSources(rows: SkillSource[][]): SkillSource[] {
  const merged = new Map<string, SkillSource>();
  for (const list of rows) {
    for (const row of list) {
      const key = `${String(row.id ?? "")}:${row.name}`;
      const current = merged.get(key);
      if (!current) {
        merged.set(key, { ...row });
        continue;
      }
      current.value = (Number(current.value) || 0) + (Number(row.value) || 0);
      current.hits = (Number(current.hits) || 0) + (Number(row.hits) || 0);
      current.downContribution = (Number(current.downContribution) || 0) + (Number(row.downContribution) || 0);
      if (!current.icon && row.icon) current.icon = row.icon;
    }
  }
  return [...merged.values()].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
}

export function mergePlayerSkillBreakdownsForAccount(
  breakdowns: Record<string, PlayerSkillBreakdown> | undefined,
  account: string,
  primaryProfession: string,
  professionList: string[],
): PlayerSkillBreakdown | undefined {
  if (!breakdowns) return undefined;
  const specific = Object.entries(breakdowns)
    .filter(([key, breakdown]) => key.startsWith(`${account}::`) && breakdown.account === account)
    .map(([, breakdown]) => breakdown);
  const rows = specific.length > 0
    ? specific
    : breakdowns[account]
      ? [breakdowns[account]]
      : Object.values(breakdowns).filter((breakdown) => breakdown.account === account);
  if (!rows.length) return undefined;
  return {
    account,
    profession: primaryProfession,
    professionList: Array.from(new Set([...professionList, ...rows.flatMap((row) => row.professionList ?? [])])),
    damage: mergeSkillSources(rows.map((row) => row.damage ?? [])),
    healing: mergeSkillSources(rows.map((row) => row.healing ?? [])),
    barrier: mergeSkillSources(rows.map((row) => row.barrier ?? [])),
  };
}
