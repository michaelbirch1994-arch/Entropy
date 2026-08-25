import type { ReportStats } from "../types/report";

export interface ProfileReportPlayerRow {
  profession: string;
  damage: number;
  dps: number;
  downContrib: number;
  healing: number;
  barrier: number;
  cleanses: number;
  strips: number;
  logsJoined: number;
}

type MutableProfileReportPlayerRow = ProfileReportPlayerRow & {
  totalFightMs: number;
  professionTimeMs: Map<string, number>;
};

function ensureRow(map: Map<string, MutableProfileReportPlayerRow>, account: string): MutableProfileReportPlayerRow {
  let row = map.get(account);
  if (!row) {
    row = {
      profession: "Unknown",
      damage: 0,
      dps: 0,
      downContrib: 0,
      healing: 0,
      barrier: 0,
      cleanses: 0,
      strips: 0,
      logsJoined: 0,
      totalFightMs: 0,
      professionTimeMs: new Map(),
    };
    map.set(account, row);
  }
  return row;
}

function addProfessionTime(row: MutableProfileReportPlayerRow, profession: string | undefined, timeMs: number | undefined) {
  if (!profession || profession === "Unknown") return;
  const time = Number(timeMs ?? 0);
  if (!Number.isFinite(time) || time <= 0) return;
  row.professionTimeMs.set(profession, (row.professionTimeMs.get(profession) ?? 0) + time);
}

function resolvePrimaryProfession(row: MutableProfileReportPlayerRow): string {
  let primary = row.profession;
  let bestTime = -1;
  for (const [profession, timeMs] of row.professionTimeMs) {
    if (timeMs > bestTime) {
      primary = profession;
      bestTime = timeMs;
    }
  }
  return primary || "Unknown";
}

export function aggregateReportPlayersForProfiles(stats: ReportStats): Map<string, ProfileReportPlayerRow> {
  const rows = new Map<string, MutableProfileReportPlayerRow>();
  const offenseAccounts = new Set<string>();

  for (const player of stats.offensePlayers ?? []) {
    if (!player.account || player.account === "Unknown") continue;
    offenseAccounts.add(player.account);
    const row = ensureRow(rows, player.account);
    row.damage += Number(player.offenseTotals?.damage ?? 0) || 0;
    row.downContrib += Number(player.offenseTotals?.downContribution ?? 0) || 0;
    const fightMs = Number(player.totalFightMs ?? 0) || 0;
    row.totalFightMs += fightMs;
    addProfessionTime(row, player.profession, fightMs);
  }

  for (const player of stats.healingPlayers ?? []) {
    if (!player.account || player.account === "Unknown") continue;
    const row = ensureRow(rows, player.account);
    row.healing += Number(player.healingTotals?.healing ?? 0) || 0;
    row.barrier += Number(player.healingTotals?.barrier ?? 0) || 0;
  }

  for (const player of stats.supportPlayers ?? []) {
    if (!player.account || player.account === "Unknown") continue;
    const row = ensureRow(rows, player.account);
    row.cleanses += Number(player.supportTotals?.condiCleanse ?? 0) || 0;
    row.strips += Number(player.supportTotals?.boonStrips ?? 0) || 0;
  }

  for (const player of stats.generalPlayers ?? []) {
    if (!player.account || player.account === "Unknown") continue;
    const row = ensureRow(rows, player.account);
    row.logsJoined = Math.min(stats.total, row.logsJoined + (Number(player.logsJoined ?? 0) || 0));
    if (!offenseAccounts.has(player.account)) {
      addProfessionTime(row, player.profession, Number(player.totalFightMs ?? 0) || 0);
    }
  }

  const result = new Map<string, ProfileReportPlayerRow>();
  for (const [account, row] of rows) {
    const profession = resolvePrimaryProfession(row);
    result.set(account, {
      profession,
      damage: row.damage,
      dps: row.totalFightMs > 0 ? row.damage / (row.totalFightMs / 1000) : 0,
      downContrib: row.downContrib,
      healing: row.healing,
      barrier: row.barrier,
      cleanses: row.cleanses,
      strips: row.strips,
      logsJoined: row.logsJoined,
    });
  }

  return result;
}
