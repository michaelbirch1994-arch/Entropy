import { buildNormalizedTopPlayerSources, mergePlayerSkillBreakdownsForAccount } from "./topPlayersNormalization";
import type {
  ConditionPlayer,
  DamageMitigationPlayer,
  GeneralPlayer,
  PlayerSkillBreakdown,
  PlayerSkillSource,
  ReportStats,
  WvWReport,
} from "../types/report";

export type DuelMetricDirection = "higher" | "lower" | "neutral";

export interface PlayerDuelOption {
  account: string;
  professions: string[];
  reports: number;
}

export interface PlayerDuelMetric {
  key: string;
  category: "overall" | "offense" | "support" | "healing" | "defense" | "mitigation" | "movement" | "conditions";
  label: string;
  a: number;
  b: number;
  direction: DuelMetricDirection;
  format: "compact" | "number" | "duration" | "percent";
  note?: string;
}

export interface PlayerDuelSourceRow {
  key: string;
  name: string;
  icon?: string;
  a: number;
  b: number;
  aHits: number;
  bHits: number;
  aDownContribution?: number;
  bDownContribution?: number;
}

export interface PlayerDuelBreakdown {
  damageSkills: PlayerDuelSourceRow[];
  healingSkills: PlayerDuelSourceRow[];
  barrierSkills: PlayerDuelSourceRow[];
  outgoingConditions: PlayerDuelSourceRow[];
  incomingConditions: PlayerDuelSourceRow[];
}

export interface PlayerDuelProfile {
  account: string;
  professions: string[];
  reportsPresent: number;
  combatTimeMs: number;
}

export interface PlayerDuelComparison {
  a: PlayerDuelProfile;
  b: PlayerDuelProfile;
  metrics: PlayerDuelMetric[];
  breakdown: PlayerDuelBreakdown;
}

function n(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sum(...values: unknown[]): number {
  let total = 0;
  for (const value of values) total += n(value);
  return total;
}

function professionsFrom(...lists: Array<string[] | undefined>): string[] {
  return Array.from(new Set(lists.flatMap((list) => list ?? []).filter(Boolean)));
}

function sumRecords(rows: Array<object | undefined>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of rows) {
    for (const [key, value] of Object.entries(row ?? {})) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      result[key] = (result[key] ?? 0) + value;
    }
  }
  return result;
}

function findLeaderboardValue(stats: ReportStats, key: string, account: string): number {
  return stats.leaderboards?.[key]?.find((entry) => entry.account === account)?.value ?? 0;
}

function playerPresent(stats: ReportStats, account: string): boolean {
  return Boolean(
    stats.offensePlayers?.some((row) => row.account === account) ||
    stats.supportPlayers?.some((row) => row.account === account) ||
    stats.healingPlayers?.some((row) => row.account === account) ||
    stats.defensePlayers?.some((row) => row.account === account) ||
    stats.generalPlayers?.some((row) => row.account === account) ||
    stats.conditionPlayers?.some((row) => row.account === account),
  );
}

export function buildPlayerDuelOptions(reports: WvWReport[]): PlayerDuelOption[] {
  const options = new Map<string, PlayerDuelOption>();
  reports.forEach((report, reportIndex) => {
    const seenInReport = new Set<string>();
    const sources = buildNormalizedTopPlayerSources(report.stats);
    for (const [account, source] of sources) {
      const current = options.get(account) ?? { account, professions: [], reports: 0 };
      current.professions = professionsFrom(current.professions, source.offense?.professionList, source.support?.professionList, source.healing?.professionList, source.defense?.professionList, source.general?.professionList);
      if (!seenInReport.has(account)) {
        current.reports += 1;
        seenInReport.add(account);
      }
      options.set(account, current);
    }
    for (const player of report.stats.conditionPlayers ?? []) {
      const current = options.get(player.account) ?? { account: player.account, professions: [], reports: 0 };
      current.professions = professionsFrom(current.professions, player.professionList, [player.profession]);
      if (!seenInReport.has(player.account)) {
        current.reports += 1;
        seenInReport.add(player.account);
      }
      options.set(player.account, current);
    }
    for (const player of report.stats.damageMitigationPlayers ?? []) {
      const current = options.get(player.account) ?? { account: player.account, professions: [], reports: 0 };
      current.professions = professionsFrom(current.professions, player.professionList, [player.profession]);
      if (!seenInReport.has(player.account)) {
        current.reports += 1;
        seenInReport.add(player.account);
      }
      options.set(player.account, current);
    }
    void reportIndex;
  });
  return [...options.values()].sort((a, b) => a.account.localeCompare(b.account));
}

function mergeSkillRows(rows: Array<PlayerSkillSource[] | undefined>): PlayerSkillSource[] {
  const merged = new Map<string, PlayerSkillSource>();
  for (const list of rows) {
    for (const row of list ?? []) {
      const key = `${row.id}:${row.name}`;
      const current = merged.get(key);
      if (!current) {
        merged.set(key, { ...row });
        continue;
      }
      current.value += n(row.value);
      current.hits += n(row.hits);
      current.downContribution = n(current.downContribution) + n(row.downContribution);
      if (!current.icon && row.icon) current.icon = row.icon;
    }
  }
  return [...merged.values()].sort((a, b) => b.value - a.value);
}

function combineSkillBreakdowns(rows: Array<PlayerSkillBreakdown | undefined>, account: string, professions: string[]): PlayerSkillBreakdown {
  return {
    account,
    profession: professions[0] ?? "Unknown",
    professionList: professions,
    damage: mergeSkillRows(rows.map((row) => row?.damage)),
    healing: mergeSkillRows(rows.map((row) => row?.healing)),
    barrier: mergeSkillRows(rows.map((row) => row?.barrier)),
  };
}

function conditionRows(players: ConditionPlayer[], account: string, key: "outgoingConditions" | "incomingConditions"): PlayerDuelSourceRow[] {
  const merged = new Map<string, PlayerDuelSourceRow>();
  for (const player of players.filter((row) => row.account === account)) {
    for (const [name, condition] of Object.entries(player[key] ?? {})) {
      const current = merged.get(name) ?? { key: name, name, icon: condition.icon, a: 0, b: 0, aHits: 0, bHits: 0 };
      current.a += n(condition.damage) || n(condition.applications);
      current.aHits += n(condition.applications);
      if (!current.icon && condition.icon) current.icon = condition.icon;
      merged.set(name, current);
    }
  }
  return [...merged.values()].sort((a, b) => b.a - a.a);
}

function sourceRows(aRows: PlayerSkillSource[], bRows: PlayerSkillSource[]): PlayerDuelSourceRow[] {
  const rows = new Map<string, PlayerDuelSourceRow>();
  for (const row of aRows) {
    const key = `${row.id}:${row.name}`;
    rows.set(key, {
      key,
      name: row.name,
      icon: row.icon,
      a: n(row.value),
      b: 0,
      aHits: n(row.hits),
      bHits: 0,
      aDownContribution: n(row.downContribution),
      bDownContribution: 0,
    });
  }
  for (const row of bRows) {
    const key = `${row.id}:${row.name}`;
    const current = rows.get(key) ?? { key, name: row.name, icon: row.icon, a: 0, b: 0, aHits: 0, bHits: 0 };
    current.b += n(row.value);
    current.bHits += n(row.hits);
    current.bDownContribution = n(current.bDownContribution) + n(row.downContribution);
    if (!current.icon && row.icon) current.icon = row.icon;
    rows.set(key, current);
  }
  return [...rows.values()].sort((a, b) => Math.max(b.a, b.b) - Math.max(a.a, a.b));
}

function flipConditionRows(rows: PlayerDuelSourceRow[]): PlayerDuelSourceRow[] {
  return rows.map((row) => ({ ...row, b: row.a, a: 0, bHits: row.aHits, aHits: 0 }));
}

interface AggregatedPlayer {
  profile: PlayerDuelProfile;
  offense: Record<string, number>;
  support: Record<string, number>;
  healing: Record<string, number>;
  defense: Record<string, number>;
  mitigation: Record<string, number>;
  general: GeneralPlayer | null;
  dodges: number;
  stability: number;
  conditionPlayers: ConditionPlayer[];
  skills: PlayerSkillBreakdown;
}

function aggregatePlayer(reports: WvWReport[], account: string): AggregatedPlayer {
  const normalizedRows = reports.map((report) => buildNormalizedTopPlayerSources(report.stats).get(account));
  const professions = professionsFrom(...normalizedRows.flatMap((row) => [row?.offense?.professionList, row?.support?.professionList, row?.healing?.professionList, row?.defense?.professionList, row?.general?.professionList]));
  const mitigationRows = reports.flatMap((report) => report.stats.damageMitigationPlayers ?? []).filter((row): row is DamageMitigationPlayer => row.account === account);
  const conditionPlayers = reports.flatMap((report) => report.stats.conditionPlayers ?? []).filter((row) => row.account === account);
  const skillRows = reports.map((report) => {
    const source = buildNormalizedTopPlayerSources(report.stats).get(account);
    const primaryProfession = source?.offense?.profession ?? source?.support?.profession ?? source?.healing?.profession ?? source?.defense?.profession ?? source?.general?.profession ?? professions[0] ?? "Unknown";
    const primaryProfessions = professionsFrom(source?.offense?.professionList, source?.support?.professionList, source?.healing?.professionList, source?.defense?.professionList, source?.general?.professionList, [primaryProfession]);
    return mergePlayerSkillBreakdownsForAccount(report.stats.playerSkillBreakdowns, account, primaryProfession, primaryProfessions);
  });
  const generalTotals = normalizedRows.map((row) => row?.general).filter((row): row is GeneralPlayer => Boolean(row));
  const offenseCombatTimeMs = normalizedRows.reduce((total, row) => total + n(row?.offense?.totalFightMs), 0);
  const generalCombatTimeMs = generalTotals.reduce((total, row) => total + n(row.totalFightMs), 0);
  const general: GeneralPlayer | null = generalTotals.length
    ? {
      account,
      profession: professions[0] ?? generalTotals[0].profession,
      professionList: professions,
      totalFightMs: generalTotals.reduce((total, row) => total + n(row.totalFightMs), 0),
      squadActiveMs: generalTotals.reduce((total, row) => total + n(row.squadActiveMs), 0),
      totalDist: generalTotals.reduce((total, row) => total + n(row.totalDist), 0),
      distCount: generalTotals.reduce((total, row) => total + n(row.distCount), 0),
      logsJoined: generalTotals.reduce((total, row) => total + n(row.logsJoined), 0),
      stackedLogCount: generalTotals.reduce((total, row) => total + n(row.stackedLogCount), 0),
    }
    : null;
  return {
    profile: {
      account,
      professions,
      reportsPresent: reports.filter((report) => playerPresent(report.stats, account)).length,
      combatTimeMs: Math.max(offenseCombatTimeMs, generalCombatTimeMs, 0),
    },
    offense: sumRecords(normalizedRows.map((row) => row?.offense?.offenseTotals)),
    support: sumRecords(normalizedRows.map((row) => row?.support?.supportTotals)),
    healing: sumRecords(normalizedRows.map((row) => row?.healing?.healingTotals)),
    defense: sumRecords(normalizedRows.map((row) => row?.defense?.defenseTotals)),
    mitigation: {
      ...sumRecords(mitigationRows.map((row) => row.mitigationTotals)),
      isEstimated: mitigationRows.some((row) => row.mitigationTotals.isEstimated) ? 1 : 0,
    },
    general,
    dodges: reports.reduce((total, report) => total + findLeaderboardValue(report.stats, "dodges", account), 0),
    stability: reports.reduce((total, report) => total + findLeaderboardValue(report.stats, "stability", account), 0),
    conditionPlayers,
    skills: combineSkillBreakdowns(skillRows, account, professions),
  };
}

function metric(category: PlayerDuelMetric["category"], key: string, label: string, a: number, b: number, direction: DuelMetricDirection = "higher", format: PlayerDuelMetric["format"] = "compact", note?: string): PlayerDuelMetric {
  return { category, key, label, a, b, direction, format, note };
}

function avgDistance(player: AggregatedPlayer): number {
  const total = n(player.general?.totalDist);
  const count = n(player.general?.distCount);
  return count > 0 ? total / count : 0;
}

function stackPct(player: AggregatedPlayer): number {
  const joined = n(player.general?.logsJoined);
  return joined > 0 ? (n(player.general?.stackedLogCount) / joined) * 100 : 0;
}

export function buildPlayerDuelComparison(reports: WvWReport[], accountA: string, accountB: string): PlayerDuelComparison {
  const a = aggregatePlayer(reports, accountA);
  const b = aggregatePlayer(reports, accountB);
  const aOutgoingConditions = conditionRows(a.conditionPlayers, accountA, "outgoingConditions");
  const bOutgoingConditions = flipConditionRows(conditionRows(b.conditionPlayers, accountB, "outgoingConditions"));
  const aIncomingConditions = conditionRows(a.conditionPlayers, accountA, "incomingConditions");
  const bIncomingConditions = flipConditionRows(conditionRows(b.conditionPlayers, accountB, "incomingConditions"));

  const metrics = [
    metric("overall", "reports", "Reports present", a.profile.reportsPresent, b.profile.reportsPresent, "higher", "number"),
    metric("overall", "combatTime", "Combat time", a.profile.combatTimeMs, b.profile.combatTimeMs, "higher", "duration"),
    metric("offense", "damage", "Damage", n(a.offense.damage), n(b.offense.damage)),
    metric("offense", "dps", "DPS", a.profile.combatTimeMs > 0 ? n(a.offense.damage) / (a.profile.combatTimeMs / 1000) : 0, b.profile.combatTimeMs > 0 ? n(b.offense.damage) / (b.profile.combatTimeMs / 1000) : 0, "higher", "number"),
    metric("offense", "powerDamage", "Power damage", n(a.offense.powerDamage), n(b.offense.powerDamage)),
    metric("offense", "conditionDamage", "Condition damage", n(a.offense.conditionDamage), n(b.offense.conditionDamage)),
    metric("offense", "criticalDamage", "Critical damage", n(a.offense.criticalDmg), n(b.offense.criticalDmg)),
    metric("offense", "downContribution", "Down contribution", n(a.offense.downContribution), n(b.offense.downContribution)),
    metric("offense", "enemyDowns", "Enemy downs", n(a.offense.downed), n(b.offense.downed), "higher", "number"),
    metric("offense", "kills", "Kills", n(a.offense.killed), n(b.offense.killed), "higher", "number"),
    metric("support", "cleanses", "Cleanses", n(a.support.condiCleanse), n(b.support.condiCleanse), "higher", "number"),
    metric("support", "strips", "Boon strips", sum(a.support.boonStrips, a.offense.boonStrips), sum(b.support.boonStrips, b.offense.boonStrips), "higher", "number"),
    metric("support", "stability", "Stability output", a.stability, b.stability, "higher", "number"),
    metric("support", "cc", "Crowd control", n(a.offense.appliedCrowdControl), n(b.offense.appliedCrowdControl), "higher", "number"),
    metric("support", "interrupts", "Interrupts", n(a.offense.interrupts), n(b.offense.interrupts), "higher", "number"),
    metric("support", "resurrects", "Resurrects", n(a.support.resurrects), n(b.support.resurrects), "higher", "number"),
    metric("support", "stunBreaks", "Stun breaks", n(a.support.stunBreak), n(b.support.stunBreak), "higher", "number"),
    metric("healing", "healing", "Healing", n(a.healing.healing), n(b.healing.healing)),
    metric("healing", "squadHealing", "Squad healing", n(a.healing.squadHealing), n(b.healing.squadHealing)),
    metric("healing", "selfHealing", "Self healing", n(a.healing.selfHealing), n(b.healing.selfHealing)),
    metric("healing", "conversionHealing", "Life steal / conversion healing", n(a.healing.conversionHealing), n(b.healing.conversionHealing)),
    metric("healing", "hybridHealing", "Hybrid healing", n(a.healing.hybridHealing), n(b.healing.hybridHealing)),
    metric("healing", "downedHealing", "Downed healing", n(a.healing.downedHealing), n(b.healing.downedHealing)),
    metric("healing", "barrier", "Barrier", n(a.healing.barrier), n(b.healing.barrier)),
    metric("defense", "damageTaken", "Damage taken", n(a.defense.damageTaken), n(b.defense.damageTaken), "lower"),
    metric("defense", "powerDamageTaken", "Power damage taken", n(a.defense.powerDamageTaken), n(b.defense.powerDamageTaken), "lower"),
    metric("defense", "conditionDamageTaken", "Condition damage taken", n(a.defense.conditionDamageTaken), n(b.defense.conditionDamageTaken), "lower"),
    metric("defense", "downsTaken", "Times downed", n(a.defense.downCount), n(b.defense.downCount), "lower", "number"),
    metric("defense", "deaths", "Deaths", n(a.defense.deadCount), n(b.defense.deadCount), "lower", "number"),
    metric("defense", "blocks", "Blocks", n(a.defense.blockedCount), n(b.defense.blockedCount), "higher", "number"),
    metric("defense", "evades", "Evades", n(a.defense.evadedCount), n(b.defense.evadedCount), "higher", "number"),
    metric("movement", "dodges", "Dodges", a.dodges, b.dodges, "neutral", "number", "Context metric: more dodges is not automatically better without pressure context."),
    metric("movement", "distanceToTag", "Avg distance to tag", avgDistance(a), avgDistance(b), "lower", "number"),
    metric("movement", "stackedPct", "Stacked fight share", stackPct(a), stackPct(b), "higher", "percent"),
    metric("mitigation", "mitigatedHits", "Mitigated hits", n(a.mitigation.totalHits), n(b.mitigation.totalHits), "higher", "number"),
    metric("mitigation", "blockedHits", "Blocked hits", n(a.mitigation.blocked), n(b.mitigation.blocked), "higher", "number"),
    metric("mitigation", "evadedHits", "Evaded hits", n(a.mitigation.evaded), n(b.mitigation.evaded), "higher", "number"),
    metric("mitigation", "invulnedHits", "Invulned hits", n(a.mitigation.invulned), n(b.mitigation.invulned), "higher", "number"),
    metric("mitigation", "estimatedMitigation", "Damage mitigated", n(a.mitigation.totalMitigation), n(b.mitigation.totalMitigation), "higher", "compact", "Raw-log reports may estimate this from avoided incoming skill averages."),
  ].filter((row) => row.a > 0 || row.b > 0);

  return {
    a: a.profile,
    b: b.profile,
    metrics,
    breakdown: {
      damageSkills: sourceRows(a.skills.damage, b.skills.damage),
      healingSkills: sourceRows(a.skills.healing, b.skills.healing),
      barrierSkills: sourceRows(a.skills.barrier, b.skills.barrier),
      outgoingConditions: sourceRows(aOutgoingConditions.map((row) => ({ id: row.key, name: row.name, icon: row.icon, value: row.a, hits: row.aHits })), bOutgoingConditions.map((row) => ({ id: row.key, name: row.name, icon: row.icon, value: row.b, hits: row.bHits }))),
      incomingConditions: sourceRows(aIncomingConditions.map((row) => ({ id: row.key, name: row.name, icon: row.icon, value: row.a, hits: row.aHits })), bIncomingConditions.map((row) => ({ id: row.key, name: row.name, icon: row.icon, value: row.b, hits: row.bHits }))),
    },
  };
}
