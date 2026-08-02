// Turns a set of raw Elite Insights fight logs (as fetched from dps.report by
// RawLogImporter) into a full Entropy WvWReport, using the vendored
// @axiapps/bridge-metrics aggregation core plus a from-scratch reimplementation
// of the report-assembly logic that lives only in AxiBridge's app-coupled
// incrementalAggregation.ts (leaderboards, MVP scoring, role classification
// wiring, squad/enemy class breakdowns, attendance).
//
// Deliberately out of scope for this pass (left as empty defaults so the
// interface stays satisfied without crashing any view): per-fight breakdown
// table, commander stats, top-skills breakdown, boon generation tables/
// leaderboards, map/timeline data, replay data. These require porting
// additional non-portable AxiBridge modules — see THIRD_PARTY_NOTICES.md and
// the "Phase 2 full parity" scoping note.

import { computePlayerAggregation, type PlayerStats } from './bridge-metrics/computePlayerAggregation';
import { classifyPlayerRoles } from './bridge-metrics/classifyPlayerRoles';
import { getProfessionColor } from './bridge-metrics/professionUtils';
import type { RawFightLog, RawFightSummary } from '../types/rawFight';
import type {
  WvWReport,
  ReportStats,
  MvpCard,
  MvpTopStat,
  MaxStat,
  LeaderboardEntry,
  Leaderboards,
  ClassSlice,
  RoleClassification,
  BoonUptimeData,
  BoonUptimeColumn,
  BoonUptimeRow,
} from '../types/report';

export interface FightInput {
  summary: RawFightSummary;
  raw: RawFightLog;
}

// --- MVP weight table (mirrors AxiBridge's DEFAULT_MVP_WEIGHT_PROFILES) ---

type Bucket = 'offensive' | 'general' | 'defensive';

const DEFAULT_TABLE: Array<{ bucket: Bucket; key: string; weight: number; label: string; higher: boolean }> = [
  { bucket: 'offensive', key: 'downContrib', weight: 1, label: 'Down Contribution', higher: true },
  { bucket: 'offensive', key: 'dps', weight: 0.2, label: 'DPS', higher: true },
  { bucket: 'offensive', key: 'damage', weight: 0.2, label: 'Damage', higher: true },
  { bucket: 'general', key: 'strips', weight: 1, label: 'Boon Strips', higher: true },
  { bucket: 'general', key: 'cc', weight: 0.7, label: 'Crowd Control', higher: true },
  { bucket: 'general', key: 'closestToTag', weight: 0.7, label: 'Distance to Tag', higher: false },
  { bucket: 'general', key: 'participation', weight: 0.7, label: 'Participation', higher: true },
  { bucket: 'general', key: 'dodges', weight: 0.4, label: 'Dodges', higher: true },
  { bucket: 'defensive', key: 'healing', weight: 1, label: 'Healing', higher: true },
  { bucket: 'defensive', key: 'downedHealing', weight: 0.7, label: 'Downed Healing', higher: true },
  { bucket: 'defensive', key: 'cleanses', weight: 1, label: 'Cleanses', higher: true },
  { bucket: 'defensive', key: 'stability', weight: 1, label: 'Stability', higher: true },
  { bucket: 'defensive', key: 'revives', weight: 0.7, label: 'Resurrects', higher: true },
];

function getVal(s: PlayerStats, k: string): number {
  switch (k) {
    case 'downContrib': return s.downContrib;
    case 'barrier': return s.barrier;
    case 'healing': return s.healing;
    case 'dodges': return s.dodges;
    case 'strips': return s.strips;
    case 'cleanses': return s.cleanses;
    case 'cc': return s.cc;
    case 'interrupts': return s.interrupts;
    case 'ccAndInterrupts': return s.cc + s.interrupts;
    case 'stability': return s.stab;
    case 'revives': return s.revives;
    case 'downedHealing': return s.healingTotals['downedHealing'] || 0;
    case 'dps': return s.totalFightMs > 0 ? s.damage / (s.totalFightMs / 1000) : 0;
    case 'damage': return s.damage;
    case 'participation': return s.logsJoined;
    case 'closestToTag': return (!s.isCommander && s.distCount > 0) ? s.totalDist / s.distCount : Number.POSITIVE_INFINITY;
    case 'kills': return s.kills;
    case 'enemyDowns': return s.enemyDowns;
    case 'damageTaken': return s.damageTaken;
    case 'breakbar': return s.breakbar;
    case 'blocks': return s.blocks;
    case 'evades': return s.evades;
    case 'misses': return s.misses;
    case 'deaths': return s.deaths;
    case 'downsTaken': return s.downs;
    case 'condiDamage': return Object.values(s.outgoingConditions).reduce((sum: number, c: any) => sum + (Number(c?.damage) || 0), 0);
    default: return 0;
  }
}

function buildLeaderboard(
  items: Array<{ account: string; profession: string; professionList?: string[]; value: number; count?: number }>,
  higherIsBetter: boolean,
): LeaderboardEntry[] {
  const filtered = items.filter((item) => Number.isFinite(item.value) && (higherIsBetter ? item.value > 0 : item.value >= 0));
  const sorted = filtered.sort((a, b) => {
    const diff = higherIsBetter ? b.value - a.value : a.value - b.value;
    return diff !== 0 ? diff : a.account.localeCompare(b.account);
  });
  let lastValue: number | null = null;
  let lastRank = 0;
  return sorted.map((item, index) => {
    if (lastValue === null || item.value !== lastValue) {
      lastRank = index + 1;
      lastValue = item.value;
    }
    return { rank: lastRank, account: item.account, profession: item.profession, professionList: item.professionList ?? [], value: item.value, count: item.count ?? 0 };
  });
}

function getTop(rows: LeaderboardEntry[]): MaxStat {
  const entry = rows[0];
  return {
    value: entry?.value ?? 0,
    player: entry?.account ?? '-',
    count: entry?.count ?? 0,
    profession: entry?.profession ?? 'Unknown',
    professionList: entry?.professionList ?? [],
  };
}

function emptyMvp(): MvpCard {
  return { account: 'None', profession: 'Unknown', professionList: [], score: -1, player: 'None', color: '#64748b', topStats: [] };
}

function rankByAccount(lb: LeaderboardEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  (lb || []).forEach((row) => {
    const account = String(row?.account || '');
    if (!account || map.has(account)) return;
    map.set(account, Number(row?.rank || 0));
  });
  return map;
}

interface MvpMetric {
  name: string;
  weight: number;
  leaderboard: LeaderboardEntry[];
  getter: (s: PlayerStats) => number;
  higher: boolean;
}

function computeCategoryScores(metrics: MvpMetric[], pool: PlayerStats[]) {
  const metricRankMaps = metrics.map((m) => rankByAccount(m.leaderboard));
  const buildTopStats = (contribs: MvpTopStat[]) =>
    [...contribs].sort((a, b) => b.ratio - a.ratio || a.rank - b.rank || a.name.localeCompare(b.name)).slice(0, 3);
  const enrichPlacement = (entry: any): MvpCard | undefined => {
    if (!entry) return undefined;
    const topStats = buildTopStats(entry.contribs);
    return {
      account: entry.account,
      profession: entry.profession,
      professionList: entry.professionList ?? [],
      score: entry.score,
      player: entry.name,
      color: getProfessionColor(entry.profession),
      reason: topStats[0]?.name || 'Top Performance',
      topStats,
      downContrib: entry.downContrib,
      cleanses: entry.cleanses,
      strips: entry.strips,
      stab: entry.stab,
      healing: entry.healing,
      barrier: entry.barrier,
      cc: entry.cc,
      interrupts: entry.interrupts,
      logsJoined: entry.logsJoined,
      totalDist: entry.totalDist,
      distCount: entry.distCount,
      stackedLogCount: entry.stackedLogCount,
      dodges: entry.dodges,
      downs: entry.downs,
      deaths: entry.deaths,
      kills: entry.kills,
      enemyDowns: entry.enemyDowns,
      damageTaken: entry.damageTaken,
      breakbar: entry.breakbar,
    };
  };

  const scores: Array<PlayerStats & { score: number; contribs: MvpTopStat[] }> = [];
  pool.forEach((stat) => {
    let score = 0;
    const contribs: MvpTopStat[] = [];
    metrics.forEach((metric, idx) => {
      if (metric.weight <= 0) return;
      const best = Number(metric.leaderboard?.[0]?.value || 0);
      if (!best) return;
      const val = Number(metric.getter(stat));
      if (!Number.isFinite(val)) return;
      const higherIsBetter = metric.higher !== false;
      if (higherIsBetter ? val <= 0 : val >= Number.POSITIVE_INFINITY || val <= 0) return;
      const ratio = higherIsBetter ? val / best : best / val;
      const rank = metricRankMaps[idx].get(stat.account) || 0;
      score += ratio * metric.weight;
      contribs.push({ name: metric.name, ratio, val: val.toLocaleString(), rank });
    });
    scores.push({ ...stat, score, contribs });
  });
  scores.sort((a, b) => b.score - a.score);

  return {
    mvp: scores[0] && scores[0].score > 0 ? (enrichPlacement(scores[0]) ?? emptyMvp()) : emptyMvp(),
    silver: enrichPlacement(scores[1]) ?? emptyMvp(),
    bronze: enrichPlacement(scores[2]) ?? emptyMvp(),
    avgScore: scores.length > 0 ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length : 0,
  };
}

// --- Boon uptime (Buffs > Boons > Uptime, like dps.report) ---
//
// Not part of bridge-metrics — EI already reports per-player buff uptime
// percentages directly on the raw log (`player.buffUptimes[].buffData[0].uptime`,
// phase 0 = full fight), and each fight's `buffMap` classifies each buff id
// as "Boon"/"Condition"/etc. So this reads the raw fights directly rather
// than going through the aggregation core, and averages uptime % across
// however many fights each player joined.

const BOON_PRIORITY = [
  'Might', 'Quickness', 'Fury', 'Alacrity', 'Protection', 'Regeneration',
  'Vigor', 'Aegis', 'Stability', 'Swiftness', 'Resistance', 'Resolution',
];

function computeBoonUptimes(fights: FightInput[], playerEntries: PlayerStats[]): BoonUptimeData {
  const buffMeta = new Map<number, { name: string; icon?: string }>();
  const acc = new Map<string, Map<number, { sum: number; count: number }>>();
  const groupByAccount = new Map<string, number>();

  for (const f of fights) {
    const raw = f.raw as Record<string, unknown>;
    const buffMap = (raw.buffMap ?? {}) as Record<string, { name?: string; icon?: string; classification?: string }>;
    for (const key of Object.keys(buffMap)) {
      const def = buffMap[key];
      if (def && def.classification === 'Boon') {
        const id = Number(key.replace(/^b/, ''));
        if (Number.isFinite(id) && !buffMeta.has(id)) {
          buffMeta.set(id, { name: def.name || `Boon ${id}`, icon: def.icon });
        }
      }
    }

    const players = (raw.players ?? []) as Record<string, unknown>[];
    for (const p of players) {
      if (p.notInSquad) continue;
      const account = typeof p.account === 'string' ? p.account : null;
      if (!account) continue;
      if (typeof p.group === 'number') groupByAccount.set(account, p.group);

      let accMap = acc.get(account);
      if (!accMap) { accMap = new Map(); acc.set(account, accMap); }

      const buffUptimes = (p.buffUptimes ?? []) as Array<{ id?: number; buffData?: Array<{ uptime?: number }> }>;
      for (const entry of buffUptimes) {
        const id = Number(entry?.id);
        if (!Number.isFinite(id)) continue;
        const uptime = Number(entry?.buffData?.[0]?.uptime);
        if (!Number.isFinite(uptime)) continue;
        const cur = accMap.get(id) || { sum: 0, count: 0 };
        cur.sum += uptime;
        cur.count += 1;
        accMap.set(id, cur);
      }
    }
  }

  const columns: BoonUptimeColumn[] = Array.from(buffMeta.entries())
    .map(([id, meta]) => ({ id, name: meta.name, icon: meta.icon }))
    .sort((a, b) => {
      const ai = BOON_PRIORITY.indexOf(a.name);
      const bi = BOON_PRIORITY.indexOf(b.name);
      if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

  const columnIds = new Set(columns.map((c) => c.id));

  const rows: BoonUptimeRow[] = playerEntries
    .filter((s) => s.account && s.account !== 'Unknown')
    .map((s) => {
      const accMap = acc.get(s.account);
      const uptimes: Record<number, number> = {};
      if (accMap) {
        accMap.forEach((v, id) => {
          if (columnIds.has(id)) uptimes[id] = v.count > 0 ? v.sum / v.count : 0;
        });
      }
      return {
        account: s.account,
        profession: s.profession,
        professionList: s.professionList ?? [],
        group: groupByAccount.get(s.account) ?? 0,
        logsJoined: s.logsJoined,
        uptimes,
      };
    })
    .sort((a, b) => a.group - b.group || a.account.localeCompare(b.account));

  return { columns, rows };
}

export function buildReportFromFights(fights: FightInput[]): WvWReport {
  if (fights.length === 0) throw new Error('No fights to combine.');

  const validLogs = fights.map((f) => ({ details: f.raw }));

  const agg = computePlayerAggregation({
    validLogs,
    method: 'count',
    skillDamageSource: 'target',
    splitPlayersByClass: false,
  });

  const {
    playerStats,
    wins, losses,
    totalSquadSizeAccum, totalEnemiesAccum,
    totalSquadDeaths, totalSquadKills, totalEnemyDeaths, totalEnemyKills,
    totalSquadDowns, totalEnemyDowns,
    enemyProfessionCounts,
  } = agg;

  const total = fights.length;
  const avgSquadSize = total > 0 ? Math.round(totalSquadSizeAccum / total) : 0;
  const avgEnemies = total > 0 ? Math.round(totalEnemiesAccum / total) : 0;
  const squadKDR = totalSquadDeaths > 0 ? (totalSquadKills / totalSquadDeaths).toFixed(2) : totalSquadKills > 0 ? '∞' : '0.00';
  const enemyKDR = totalEnemyDeaths > 0 ? (totalEnemyKills / totalEnemyDeaths).toFixed(2) : totalEnemyKills > 0 ? '∞' : '0.00';

  // Resolve primary profession per player (most time played), matching upstream.
  const playerEntries: PlayerStats[] = Array.from(playerStats.values()).map((stat) => {
    const list = Array.from(stat.professions).filter((p) => p !== 'Unknown');
    stat.professionList = list;
    if (list.length > 0) {
      let primary = list[0];
      let maxTime = stat.professionTimeMs[primary] || 0;
      list.forEach((prof) => {
        const t = stat.professionTimeMs[prof] || 0;
        if (t > maxTime) { maxTime = t; primary = prof; }
      });
      stat.profession = primary;
    }
    return stat;
  });

  const createLB = (k: string, higher: boolean) => buildLeaderboard(
    playerEntries.map((stat) => ({ account: stat.account, profession: stat.profession, professionList: stat.professionList, value: getVal(stat, k), count: stat.logsJoined })),
    higher,
  );

  const leaderboards: Leaderboards = {
    downContrib: createLB('downContrib', true),
    barrier: createLB('barrier', true),
    healing: createLB('healing', true),
    dodges: createLB('dodges', true),
    strips: createLB('strips', true),
    cleanses: createLB('cleanses', true),
    cc: createLB('cc', true),
    interrupts: createLB('interrupts', true),
    ccAndInterrupts: createLB('ccAndInterrupts', true),
    stability: createLB('stability', true),
    revives: createLB('revives', true),
    downedHealing: createLB('downedHealing', true),
    participation: createLB('participation', true),
    dps: createLB('dps', true),
    damage: createLB('damage', true),
    closestToTag: createLB('closestToTag', false).filter((i) => Number.isFinite(i.value)),
    kills: createLB('kills', true),
    enemyDowns: createLB('enemyDowns', true),
    breakbar: createLB('breakbar', true),
    condiDamage: createLB('condiDamage', true),
    blocks: createLB('blocks', true),
    evades: createLB('evades', true),
    misses: createLB('misses', true),
    deaths: createLB('deaths', false),
    downsTaken: createLB('downsTaken', false),
    damageTaken: createLB('damageTaken', false),
  };

  // Role classification (boon tables intentionally empty for this pass — full
  // boon-generation ingestion is out of scope; see module header).
  const roleMap = classifyPlayerRoles(playerEntries, []);
  for (const stat of playerEntries) {
    const rc = roleMap.get(stat.account);
    if (rc) stat.roleClassification = rc;
  }

  const buildMetrics = (bucket: Bucket): MvpMetric[] =>
    DEFAULT_TABLE.filter((d) => d.bucket === bucket).map((d) => ({
      name: d.label,
      weight: d.weight,
      higher: d.higher,
      leaderboard: leaderboards[d.key as keyof Leaderboards] || [],
      getter: (s: PlayerStats) => getVal(s, d.key),
    }));

  const offensiveMetrics = buildMetrics('offensive');
  const generalMetrics = buildMetrics('general');
  const defensiveMetrics = buildMetrics('defensive');

  const offensiveCandidates = playerEntries.filter((s) => s.roleClassification?.role === 'damage');
  const offensivePool = offensiveCandidates.length > 0 ? offensiveCandidates : playerEntries;
  const offensiveScores = computeCategoryScores([...offensiveMetrics, ...generalMetrics], offensivePool);

  const defensiveCandidates = playerEntries.filter((s) => s.roleClassification?.role === 'support');
  const defensivePool = defensiveCandidates.length > 0 ? defensiveCandidates : playerEntries;
  const defensiveScores = computeCategoryScores([...defensiveMetrics, ...generalMetrics], defensivePool);

  // Squad / enemy class breakdowns
  const squadClassCounts: Record<string, number> = {};
  playerEntries.forEach((p) => {
    if (p.profession && p.profession !== 'Unknown') squadClassCounts[p.profession] = (squadClassCounts[p.profession] || 0) + 1;
  });
  const squadClassData: ClassSlice[] = Object.entries(squadClassCounts)
    .map(([name, value]) => ({ name, value, color: getProfessionColor(name) }))
    .sort((a, b) => b.value - a.value);

  const enemyClassData: ClassSlice[] = Object.entries(enemyProfessionCounts || {})
    .map(([name, value]) => ({ name, value, color: getProfessionColor(name) || '#f87171' }))
    .sort((a, b) => b.value - a.value);

  // Attendance
  const attendanceData = playerEntries
    .map((entry) => {
      const classTimes = Object.entries(entry.professionTimeMs || {})
        .map(([profession, timeMs]) => ({ profession, timeMs: Number(timeMs || 0) }))
        .filter((row) => row.profession && row.profession !== 'Unknown' && row.timeMs > 0)
        .sort((a, b) => b.timeMs - a.timeMs || a.profession.localeCompare(b.profession));
      const firstTs = Number(entry.firstSeenFightTs || 0);
      const lastTs = Number(entry.lastSeenFightTs || 0);
      const lastDurationMs = Math.max(0, Number(entry.lastSeenFightDurationMs || 0));
      const squadTimeMs = firstTs > 0 && lastTs > 0
        ? Math.max(0, (lastTs + lastDurationMs) - firstTs)
        : Number(entry.squadActiveMs || entry.totalFightMs || 0);
      return {
        account: entry.account || 'Unknown',
        characterNames: Array.from(entry.characterNames || []).filter(Boolean).sort((a, b) => a.localeCompare(b)),
        classTimes,
        combatTimeMs: Number(entry.squadActiveMs || entry.totalFightMs || 0),
        squadTimeMs,
      };
    })
    .filter((row) => row.account && row.account !== 'Unknown')
    .sort((a, b) => b.squadTimeMs - a.squadTimeMs || a.account.localeCompare(b.account));

  // Role classifications (final shape expected by ClassesView)
  const roleClassifications: RoleClassification[] = playerEntries
    .filter((s) => !!s.roleClassification)
    .map((s) => ({
      account: s.account,
      profession: s.profession,
      professionList: s.professionList ?? [],
      role: s.roleClassification.role,
      supportScore: s.roleClassification.supportScore,
      confidenceScore: s.roleClassification.confidenceScore,
      threshold: s.roleClassification.threshold,
      factors: s.roleClassification.factors,
    }));

  const stats: ReportStats = {
    total, wins, losses, avgSquadSize, avgEnemies, squadKDR, enemyKDR,
    totalSquadKills, totalSquadDeaths, totalEnemyKills, totalEnemyDeaths, totalSquadDowns, totalEnemyDowns,
    leaderboards,
    maxDownContrib: getTop(leaderboards.downContrib),
    maxBarrier: getTop(leaderboards.barrier),
    maxHealing: getTop(leaderboards.healing),
    maxDodges: getTop(leaderboards.dodges),
    maxStrips: getTop(leaderboards.strips),
    maxCleanses: getTop(leaderboards.cleanses),
    maxCC: getTop(leaderboards.cc),
    maxInterrupts: getTop(leaderboards.interrupts),
    maxCCAndInterrupts: getTop(leaderboards.ccAndInterrupts),
    maxStab: getTop(leaderboards.stability),
    closestToTag: getTop(leaderboards.closestToTag),
    topSkills: [],
    topIncomingSkills: [],
    topSkillsByDamage: [],
    topSkillsByDownContribution: [],
    mapData: [],
    timelineData: [],
    offensePlayers: playerEntries.map((s) => ({
      account: s.account, profession: s.profession, professionList: s.professionList ?? [],
      offenseTotals: s.offenseTotals as any, offenseRateWeights: s.offenseRateWeights, totalFightMs: s.totalFightMs,
    })),
    defensePlayers: playerEntries.map((s) => ({
      account: s.account, profession: s.profession, professionList: s.professionList ?? [],
      defenseTotals: s.defenseTotals as any, totalFightMs: s.totalFightMs,
    })),
    supportPlayers: playerEntries.map((s) => ({
      account: s.account, profession: s.profession, professionList: s.professionList ?? [],
      supportTotals: s.supportTotals as any, activeMs: s.supportActiveMs, logsJoined: s.logsJoined,
    })),
    healingPlayers: playerEntries.map((s) => ({
      account: s.account, profession: s.profession, professionList: s.professionList ?? [],
      healingTotals: s.healingTotals as any, activeMs: s.healingActiveMs, hasHealAddon: s.hasHealAddon,
    })),
    generalPlayers: playerEntries.map((s) => ({
      account: s.account, profession: s.profession, professionList: s.professionList ?? [],
      totalFightMs: s.totalFightMs, squadActiveMs: s.squadActiveMs,
      totalDist: s.totalDist, distCount: s.distCount, logsJoined: s.logsJoined, stackedLogCount: s.stackedLogCount,
    })),
    offensiveMvp: offensiveScores.mvp,
    offensiveSilver: offensiveScores.silver,
    offensiveBronze: offensiveScores.bronze,
    defensiveMvp: defensiveScores.mvp,
    defensiveSilver: defensiveScores.silver,
    defensiveBronze: defensiveScores.bronze,
    mvp: offensiveScores.mvp,
    silver: offensiveScores.silver,
    bronze: offensiveScores.bronze,
    squadClassData,
    enemyClassData,
    fightBreakdown: [],
    commanderStats: { rows: [] },
    roleClassifications,
    attendanceData,
    boonUptimes: computeBoonUptimes(fights, playerEntries),
    offensiveAvgMvpScore: offensiveScores.avgScore,
    defensiveAvgMvpScore: defensiveScores.avgScore,
    avgMvpScore: (offensiveScores.avgScore + defensiveScores.avgScore) / 2,
    colorPalette: 'amber',
  };

  // Meta
  const timestamps = fights
    .map((f) => Date.parse((f.raw as any)?.timeStartStd ?? f.summary.timeStart ?? '') || 0)
    .filter((t) => t > 0)
    .sort((a, b) => a - b);
  const dateStartMs = timestamps[0] ?? Date.now();
  const dateEndMs = timestamps[timestamps.length - 1] ?? dateStartMs;
  const dateStart = new Date(dateStartMs).toISOString();
  const dateEnd = new Date(dateEndMs).toISOString();
  const dateLabel = new Date(dateStartMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const commanders = Array.from(new Set(playerEntries.filter((s) => s.isCommander).map((s) => s.account)));

  const title = fights.length === 1
    ? (fights[0].summary.fightName || 'Raw Fight')
    : `${fights.length} Fights Combined`;

  const id = `raw-${fights.map((f) => f.summary.permalink || f.summary.fightName).join('-').slice(0, 80)}-${dateStartMs}`;

  return {
    meta: {
      id,
      title,
      commanders,
      dateStart,
      dateEnd,
      dateLabel,
      generatedAt: new Date().toISOString(),
      appVersion: 'entropy-raw-v1',
      trimmedSections: ['fightBreakdown', 'commanderStats', 'topSkills', 'mapData', 'timelineData', 'boonTables', 'replayFights'],
    },
    stats,
  };
}
