import type { ConditionPlayer, ConditionSkillEntry, PlayerConditionEntry } from "../types/report";

function groupByAccount<T extends { account: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const current = grouped.get(row.account) ?? [];
    current.push(row);
    grouped.set(row.account, current);
  }
  return grouped;
}

function professionListFor(rows: ConditionPlayer[]): string[] {
  return Array.from(
    new Set(
      rows
        .flatMap((row) => [row.profession, ...(row.professionList ?? [])])
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function mergeSkills(skillMaps: Array<Record<string, ConditionSkillEntry> | undefined>): Record<string, ConditionSkillEntry> {
  const merged: Record<string, ConditionSkillEntry> = {};
  for (const skillMap of skillMaps) {
    for (const [key, skill] of Object.entries(skillMap ?? {})) {
      const current = merged[key];
      if (!current) {
        merged[key] = { ...skill };
        continue;
      }
      current.hits = (Number(current.hits) || 0) + (Number(skill.hits) || 0);
      current.damage = (Number(current.damage) || 0) + (Number(skill.damage) || 0);
      if (!current.icon && skill.icon) current.icon = skill.icon;
      if ((!current.name || current.name === "Unknown") && skill.name) current.name = skill.name;
    }
  }
  return merged;
}

function mergeConditionEntries(entries: Array<PlayerConditionEntry | undefined>): PlayerConditionEntry | undefined {
  const present = entries.filter((entry): entry is PlayerConditionEntry => Boolean(entry));
  if (!present.length) return undefined;

  const merged: PlayerConditionEntry = {
    applications: 0,
    damage: 0,
    skills: mergeSkills(present.map((entry) => entry.skills)),
  };

  for (const entry of present) {
    merged.applications += Number(entry.applications) || 0;
    merged.damage += Number(entry.damage) || 0;
    if (!merged.icon && entry.icon) merged.icon = entry.icon;
    if (Number.isFinite(entry.applicationsFromBuffs)) {
      merged.applicationsFromBuffs = (merged.applicationsFromBuffs ?? 0) + Number(entry.applicationsFromBuffs);
    }
    if (Number.isFinite(entry.applicationsFromBuffsActive)) {
      merged.applicationsFromBuffsActive = (merged.applicationsFromBuffsActive ?? 0) + Number(entry.applicationsFromBuffsActive);
    }
    if (Number.isFinite(entry.uptimeMs)) {
      merged.uptimeMs = (merged.uptimeMs ?? 0) + Number(entry.uptimeMs);
    }
  }

  return merged;
}

function mergeConditionMap(rows: ConditionPlayer[], key: "outgoingConditions" | "incomingConditions") {
  const names = new Set(rows.flatMap((row) => Object.keys(row[key] ?? {})));
  const merged: Record<string, PlayerConditionEntry> = {};
  for (const name of names) {
    const entry = mergeConditionEntries(rows.map((row) => row[key]?.[name]));
    if (entry) merged[name] = entry;
  }
  return merged;
}

/**
 * Modern reports contain one condition row per account. Older archived reports
 * may contain one row per profession after a build swap; recombine those slices
 * so charts, player counts, detail rows, nested skill totals, and sample fallbacks
 * describe the whole account.
 */
export function normalizeConditionPlayers(
  players: ConditionPlayer[] | undefined,
  totalFights: number,
): ConditionPlayer[] {
  const safeTotalFights = Math.max(0, Math.floor(Number(totalFights) || 0));
  return Array.from(groupByAccount(players ?? []).values()).map((rows) => {
    const primary = [...rows].sort((a, b) => (Number(b.totalFightMs) || 0) - (Number(a.totalFightMs) || 0))[0];
    return {
      account: primary.account,
      profession: primary.profession,
      professionList: professionListFor(rows),
      totalFightMs: rows.reduce((sum, row) => sum + Math.max(0, Number(row.totalFightMs) || 0), 0),
      squadActiveMs: rows.reduce((sum, row) => sum + Math.max(0, Number(row.squadActiveMs) || 0), 0),
      logsJoined: Math.min(
        safeTotalFights,
        rows.reduce((sum, row) => sum + Math.max(0, Number(row.logsJoined) || 0), 0),
      ),
      outgoingConditions: mergeConditionMap(rows, "outgoingConditions"),
      incomingConditions: mergeConditionMap(rows, "incomingConditions"),
    };
  });
}
