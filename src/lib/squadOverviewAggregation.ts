import { pickAllyScopeValue, type AllyScope } from "../store/AllyScopeContext";
import { pickDamageScopeValue, type DamageScope } from "../store/DamageScopeContext";
import type {
  HealingCoverage,
  HealingPlayer,
  HealingTotals,
  ReportStats,
  SupportTotals,
} from "../types/report";

export interface SquadOverviewRow {
  account: string;
  profession: string;
  professionList: string[];
  damage: number;
  dps: number;
  downContribution: number;
  heal?: HealingPlayer;
  healing: number;
  cleanses: number;
  strips: number;
  combatMs: number;
  logs: number;
  participation: number;
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

function healingCoverageFor(player: HealingPlayer): HealingCoverage {
  if (player.healingCoverage) return player.healingCoverage;
  if (player.hasHealAddon) return "full";
  return (player.healingTotals.healing ?? 0) > 0 ? "partial" : "none";
}

function mergeHealingPlayers(players: HealingPlayer[]): HealingPlayer | undefined {
  if (players.length === 0) return undefined;
  const healingTotals = sumNumericRecords(players.map((player) => player.healingTotals)) as HealingTotals;
  const coverages = players.map(healingCoverageFor);
  const hasObservedHealing = (healingTotals.healing ?? 0) > 0;
  const healingCoverage: HealingCoverage = coverages.every((coverage) => coverage === "full")
    ? "full"
    : hasObservedHealing
      ? "partial"
      : "none";
  const primary = [...players].sort((a, b) => (b.activeMs ?? 0) - (a.activeMs ?? 0))[0];
  const professionList = Array.from(
    new Set(players.flatMap((player) => [player.profession, ...(player.professionList ?? [])]).filter(Boolean)),
  );

  return {
    account: primary.account,
    profession: primary.profession,
    professionList,
    healingTotals,
    activeMs: players.reduce((sum, player) => sum + (player.activeMs ?? 0), 0),
    hasHealAddon: healingCoverage === "full",
    healingCoverage,
  };
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

export function buildSquadOverviewRows(
  stats: ReportStats,
  damageScope: DamageScope,
  allyScope: AllyScope,
): SquadOverviewRow[] {
  const offenseByAccount = groupByAccount(stats.offensePlayers ?? []);
  const healingByAccount = groupByAccount(stats.healingPlayers ?? []);
  const supportByAccount = groupByAccount(stats.supportPlayers ?? []);
  const generalByAccount = groupByAccount(stats.generalPlayers ?? []);
  const attendanceByAccount = new Map((stats.attendanceData ?? []).map((row) => [row.account, row]));

  return Array.from(offenseByAccount.entries()).map(([account, offenseRows]) => {
    const primaryOffense = [...offenseRows].sort((a, b) => (b.totalFightMs ?? 0) - (a.totalFightMs ?? 0))[0];
    const professionList = Array.from(
      new Set(offenseRows.flatMap((row) => [row.profession, ...(row.professionList ?? [])]).filter(Boolean)),
    );
    const totalFightMs = offenseRows.reduce((sum, row) => sum + (row.totalFightMs ?? 0), 0);
    const damage = offenseRows.reduce(
      (sum, row) => sum + pickDamageScopeValue(damageScope, row.offenseTotals.damage, row.offenseTotals.damageAll),
      0,
    );
    const downContribution = offenseRows.reduce(
      (sum, row) => sum + (row.offenseTotals.downContribution ?? 0),
      0,
    );

    const healingRows = healingByAccount.get(account) ?? [];
    const heal = mergeHealingPlayers(healingRows);
    const healing = heal
      ? pickAllyScopeValue(allyScope, heal.healingTotals.healing, heal.healingTotals.squadHealing)
      : 0;

    const supportRows = supportByAccount.get(account) ?? [];
    const supportTotals = sumNumericRecords(supportRows.map((row) => row.supportTotals)) as SupportTotals;

    const generalRows = generalByAccount.get(account) ?? [];
    const attendance = attendanceByAccount.get(account);
    const fallbackCombatMs = generalRows.reduce(
      (sum, row) => sum + (row.squadActiveMs ?? row.totalFightMs ?? 0),
      0,
    );
    const combatMs = (attendance?.combatTimeMs ?? 0) > 0 ? attendance!.combatTimeMs : fallbackCombatMs;
    const logs = Math.min(
      stats.total,
      generalRows.reduce((sum, row) => sum + (row.logsJoined ?? 0), 0),
    );
    const participation = stats.total > 0 ? Math.min(1, logs / stats.total) : 0;

    return {
      account,
      profession: primaryOffense?.profession ?? professionList[0] ?? "Unknown",
      professionList,
      damage,
      dps: totalFightMs > 0 ? damage / (totalFightMs / 1000) : 0,
      downContribution,
      heal,
      healing,
      cleanses: supportTotals.condiCleanse ?? 0,
      strips: supportTotals.boonStrips ?? 0,
      combatMs,
      logs,
      participation,
    };
  });
}
