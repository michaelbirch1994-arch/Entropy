import type {
  DamageMitigationPlayer,
  DefensePlayer,
  HealingCoverage,
  HealingPlayer,
  HealingTotals,
  ReportStats,
  SupportPlayer,
  SupportTotals,
} from "../types/report";

export interface NormalizedDefensivePlayerRows {
  supportPlayers: SupportPlayer[];
  healingPlayers: HealingPlayer[];
  defensePlayers: DefensePlayer[];
  damageMitigationPlayers: DamageMitigationPlayer[];
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
      if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
      totals[key] = (totals[key] ?? 0) + raw;
    }
  }
  return totals as T;
}

function professionListFor(rows: Array<{ profession?: string; professionList?: string[] }>): string[] {
  return Array.from(
    new Set(
      rows
        .flatMap((row) => [row.profession, ...(row.professionList ?? [])])
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function healingCoverageFor(player: HealingPlayer): HealingCoverage {
  if (player.healingCoverage) return player.healingCoverage;
  if (player.hasHealAddon) return "full";
  return (player.healingTotals.healing ?? 0) > 0 ? "partial" : "none";
}

function mergeSupport(rows: SupportPlayer[], totalFights: number): SupportPlayer | undefined {
  if (!rows.length) return undefined;
  const primary = [...rows].sort((a, b) => (b.activeMs ?? 0) - (a.activeMs ?? 0))[0];
  return {
    account: primary.account,
    profession: primary.profession,
    professionList: professionListFor(rows),
    supportTotals: sumNumericRecords(rows.map((row) => row.supportTotals)) as SupportTotals,
    activeMs: rows.reduce((sum, row) => sum + (Number(row.activeMs) || 0), 0),
    logsJoined: Math.min(
      Math.max(0, Number(totalFights) || 0),
      rows.reduce((sum, row) => sum + Math.max(0, Number(row.logsJoined) || 0), 0),
    ),
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
    activeMs: rows.reduce((sum, row) => sum + (Number(row.activeMs) || 0), 0),
    hasHealAddon: healingCoverage === "full",
    healingCoverage,
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
    totalFightMs: rows.reduce((sum, row) => sum + (Number(row.totalFightMs) || 0), 0),
  };
}

function mergeMitigation(rows: DamageMitigationPlayer[]): DamageMitigationPlayer | undefined {
  if (!rows.length) return undefined;
  const primary = [...rows].sort((a, b) => (b.activeMs ?? 0) - (a.activeMs ?? 0))[0];
  const numericTotals = sumNumericRecords(rows.map((row) => row.mitigationTotals));
  const isEstimated = rows.some((row) =>
    row.mitigationTotals.isEstimated &&
    ((row.mitigationTotals.totalMitigation ?? 0) > 0 || (row.mitigationTotals.minMitigation ?? 0) > 0),
  );

  return {
    account: primary.account,
    name: primary.name,
    profession: primary.profession,
    professionList: professionListFor(rows),
    activeMs: rows.reduce((sum, row) => sum + (Number(row.activeMs) || 0), 0),
    mitigationTotals: {
      ...numericTotals,
      isEstimated,
    },
  } as DamageMitigationPlayer;
}

export function normalizeDefensivePlayerRows(stats: ReportStats | undefined): NormalizedDefensivePlayerRows {
  if (!stats) {
    return {
      supportPlayers: [],
      healingPlayers: [],
      defensePlayers: [],
      damageMitigationPlayers: [],
    };
  }

  return {
    supportPlayers: Array.from(groupByAccount(stats.supportPlayers ?? []).values())
      .map((rows) => mergeSupport(rows, stats.total))
      .filter((row): row is SupportPlayer => Boolean(row)),
    healingPlayers: Array.from(groupByAccount(stats.healingPlayers ?? []).values())
      .map(mergeHealing)
      .filter((row): row is HealingPlayer => Boolean(row)),
    defensePlayers: Array.from(groupByAccount(stats.defensePlayers ?? []).values())
      .map(mergeDefense)
      .filter((row): row is DefensePlayer => Boolean(row)),
    damageMitigationPlayers: Array.from(groupByAccount(stats.damageMitigationPlayers ?? []).values())
      .map(mergeMitigation)
      .filter((row): row is DamageMitigationPlayer => Boolean(row)),
  };
}
