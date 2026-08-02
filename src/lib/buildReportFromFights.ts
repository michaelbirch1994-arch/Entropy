// Turns a set of raw Elite Insights fight logs (as fetched from dps.report by
// RawLogImporter) into a full Entropy WvWReport, using the vendored
// @axiapps/bridge-metrics aggregation core plus a from-scratch reimplementation
// of the report-assembly logic that lives only in AxiBridge's app-coupled
// incrementalAggregation.ts (leaderboards, MVP scoring, role classification
// wiring, squad/enemy class breakdowns, attendance).
//
// Deliberately out of scope for this pass (left as empty defaults so the
// interface stays satisfied without crashing any view): per-fight breakdown
// table, commander stats, boon generation tables/leaderboards, map/timeline
// data. These require porting additional non-portable AxiBridge modules —
// see THIRD_PARTY_NOTICES.md and the "Phase 2 full parity" scoping note.

import { computePlayerAggregation, type PlayerStats } from './bridge-metrics/computePlayerAggregation';
import { classifyPlayerRoles } from './bridge-metrics/classifyPlayerRoles';
import { getProfessionColor } from './bridge-metrics/professionUtils';
import { parseReplayData } from './parseReplayData';
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
  TopSkill,
  DamageModifierData,
  RotationsData,
  DpsGraphData,
  SynergyInsight,
  MechanicsData,
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

// `count` on a leaderboard entry is logsJoined (used for the "N logs" caption
// under a stat card) - it is NOT seconds, so dividing value/count gives a
// per-fight average, not a per-second rate. Cards labelled "/s" need the
// leading player's actual tracked playtime, so this also looks up their
// totalFightMs from the same player pool the leaderboard was built from.
function getTop(rows: LeaderboardEntry[], pool?: PlayerStats[]): MaxStat {
  const entry = rows[0];
  const stat = entry ? pool?.find((s) => s.account === entry.account) : undefined;
  return {
    value: entry?.value ?? 0,
    player: entry?.account ?? '-',
    count: entry?.count ?? 0,
    totalMs: stat?.totalFightMs ?? 0,
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

// EI classifies every buff on its HTML tables with one of these values
// (GW2EIJSON.JsonLog.BuffDesc.Classification, confirmed against the EI JSON
// doc) - this is exactly the same grouping dps.report uses for its Buffs
// sub-tabs (Boons / Offensive Buffs / Support Buffs / Defensive Buffs /
// Conditions / Gear Buffs / Debuffs / Nourishments / Enhancements / Other
// Consumables / Personal Buffs, the last of which maps to EI's "Other").
const BUFF_CLASSIFICATIONS: Record<string, string> = {
  Boon: 'Boons',
  Condition: 'Conditions',
  Offensive: 'Offensive Buffs',
  Defensive: 'Defensive Buffs',
  Support: 'Support Buffs',
  Debuff: 'Debuffs',
  Gear: 'Gear Buffs',
  Enhancement: 'Enhancements',
  Nourishment: 'Nourishments',
  'Other Consumable': 'Other Consumables',
  Other: 'Personal Buffs',
};

// Computes an uptime table (like computeBoonUptimes used to, single-category)
// for every EI buff classification in one pass over the fights, so the Buffs
// view can offer the full set of dps.report-style tabs instead of just Boons.
function computeBuffCategoryUptimes(fights: FightInput[], playerEntries: PlayerStats[]): Record<string, BoonUptimeData> {
  const buffMetaByClass = new Map<string, Map<number, { name: string; icon?: string }>>();
  const accByClass = new Map<string, Map<string, Map<number, { sum: number; count: number }>>>();
  const groupByAccount = new Map<string, number>();

  for (const cls of Object.keys(BUFF_CLASSIFICATIONS)) {
    buffMetaByClass.set(cls, new Map());
    accByClass.set(cls, new Map());
  }

  for (const f of fights) {
    const raw = f.raw as Record<string, unknown>;
    const buffMap = (raw.buffMap ?? {}) as Record<string, { name?: string; icon?: string; classification?: string }>;
    const idToClass = new Map<number, string>();
    for (const key of Object.keys(buffMap)) {
      const def = buffMap[key];
      const cls = def?.classification;
      if (def && cls && BUFF_CLASSIFICATIONS[cls]) {
        const id = Number(key.replace(/^b/, ''));
        if (!Number.isFinite(id)) continue;
        idToClass.set(id, cls);
        const meta = buffMetaByClass.get(cls)!;
        if (!meta.has(id)) meta.set(id, { name: def.name || `Buff ${id}`, icon: def.icon });
      }
    }

    const players = (raw.players ?? []) as Record<string, unknown>[];
    for (const p of players) {
      if (p.notInSquad) continue;
      const account = typeof p.account === 'string' ? p.account : null;
      if (!account) continue;
      if (typeof p.group === 'number') groupByAccount.set(account, p.group);

      const buffUptimes = (p.buffUptimes ?? []) as Array<{ id?: number; buffData?: Array<{ uptime?: number }> }>;
      for (const entry of buffUptimes) {
        const id = Number(entry?.id);
        if (!Number.isFinite(id)) continue;
        const cls = idToClass.get(id);
        if (!cls) continue;
        const uptime = Number(entry?.buffData?.[0]?.uptime);
        if (!Number.isFinite(uptime)) continue;

        const accMapByAccount = accByClass.get(cls)!;
        let accMap = accMapByAccount.get(account);
        if (!accMap) { accMap = new Map(); accMapByAccount.set(account, accMap); }
        const cur = accMap.get(id) || { sum: 0, count: 0 };
        cur.sum += uptime;
        cur.count += 1;
        accMap.set(id, cur);
      }
    }
  }

  const result: Record<string, BoonUptimeData> = {};
  for (const cls of Object.keys(BUFF_CLASSIFICATIONS)) {
    const buffMeta = buffMetaByClass.get(cls)!;
    const acc = accByClass.get(cls)!;

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
      .filter((row) => Object.keys(row.uptimes).length > 0)
      .sort((a, b) => a.group - b.group || a.account.localeCompare(b.account));

    result[BUFF_CLASSIFICATIONS[cls]] = { columns, rows };
  }

  return result;
}

// Per-player damage-modifier (traits/sigils/runes/food that add or gate bonus
// damage) breakdown, mirroring dps.report's "Damage Modifiers" tab. Reads
// straight from EI's raw player.damageModifiers[] (phase 0 = full fight) and
// raw.damageModMap for names/icons (confirmed against the EI JSON doc:
// JsonPlayer.DamageModifiers / JsonLog.DamageModMap / DamageModDesc).
function computeDamageModifiers(fights: FightInput[]): DamageModifierData {
  type ModItem = { hitCount?: number; totalHitCount?: number; damageGain?: number; totalDamage?: number };
  type ModEntry = { id?: number; damageModifiers?: ModItem[] };

  const modMeta = new Map<number, { name: string; icon?: string; description?: string; nonMultiplier: boolean; isCounter: boolean }>();
  const totals = new Map<number, number>();
  const playerSets = new Map<number, Set<string>>();
  // Keyed by "account||profession", not just account: in a combined WvW
  // report the same squad member can appear on different classes across
  // different fights (very common - people swap builds/relics/alts between
  // pulls). Keying by account alone would merge those into one row and show
  // a class with traits/relics it can never actually run (e.g. a Warrior
  // row lit up for a Guardian-only trait, or several mutually-exclusive
  // relics "active" at once) just because the same account played other
  // classes in other fights. One row per account+class keeps every row's
  // modifiers honest to the class actually shown.
  const rowsByKey = new Map<string, { account: string; profession: string; professionList: string[]; group: number; values: Map<number, { damage: number; hits: number }> }>();

  for (const f of fights) {
    const raw = f.raw as Record<string, unknown>;
    const modMap = (raw.damageModMap ?? {}) as Record<string, { name?: string; icon?: string; description?: string; incoming?: boolean; nonMultiplier?: boolean; isCounter?: boolean }>;
    const idToDesc = new Map<number, { name?: string; icon?: string; description?: string; incoming?: boolean; nonMultiplier?: boolean; isCounter?: boolean }>();
    for (const key of Object.keys(modMap)) {
      const id = Number(key.replace(/^d/, ''));
      if (!Number.isFinite(id)) continue;
      idToDesc.set(id, modMap[key]);
    }

    const players = (raw.players ?? []) as Record<string, unknown>[];
    for (const p of players) {
      if (p.notInSquad) continue;
      const account = typeof p.account === 'string' ? p.account : null;
      if (!account) continue;
      const profession = String(p.profession || 'Unknown');
      const rowKey = `${account}||${profession}`;

      let row = rowsByKey.get(rowKey);
      if (!row) {
        row = { account, profession, professionList: [], group: Number(p.group) || 0, values: new Map() };
        rowsByKey.set(rowKey, row);
      }

      const mods = (p.damageModifiers ?? []) as ModEntry[];
      for (const entry of mods) {
        const id = Number(entry?.id);
        if (!Number.isFinite(id)) continue;
        const desc = idToDesc.get(id);
        if (desc?.incoming) continue;
        const item = entry.damageModifiers?.[0];
        if (!item) continue;
        const damage = Number(item.damageGain) || 0;
        const hits = Number(item.totalHitCount) || 0;
        if (damage === 0 && hits === 0) continue;

        if (!modMeta.has(id)) {
          modMeta.set(id, {
            name: desc?.name || `Modifier ${id}`,
            icon: desc?.icon,
            description: desc?.description,
            nonMultiplier: !!desc?.nonMultiplier,
            isCounter: !!desc?.isCounter,
          });
        }
        totals.set(id, (totals.get(id) || 0) + damage);
        if (!playerSets.has(id)) playerSets.set(id, new Set());
        playerSets.get(id)!.add(account);

        const cur = row.values.get(id) || { damage: 0, hits: 0 };
        cur.damage += damage;
        cur.hits += hits;
        row.values.set(id, cur);
      }
    }
  }

  const columns: DamageModifierData['columns'] = Array.from(modMeta.entries())
    .map(([id, meta]) => ({
      id,
      name: meta.name,
      icon: meta.icon,
      description: meta.description,
      nonMultiplier: meta.nonMultiplier,
      isCounter: meta.isCounter,
      playersWithIt: playerSets.get(id)?.size ?? 0,
    }))
    .sort((a, b) => (totals.get(b.id) || 0) - (totals.get(a.id) || 0))
    .slice(0, 24);
  const columnIds = new Set(columns.map((c) => c.id));

  const rows: DamageModifierData['rows'] = Array.from(rowsByKey.values())
    .map((row) => {
      const values: Record<number, { damage: number; hits: number }> = {};
      row.values.forEach((v, id) => {
        if (columnIds.has(id)) values[id] = v;
      });
      return { account: row.account, profession: row.profession, professionList: row.professionList, group: row.group, values };
    })
    .filter((row) => Object.keys(row.values).length > 0)
    .sort((a, b) => a.group - b.group || a.account.localeCompare(b.account) || a.profession.localeCompare(b.profession));

  return { columns, rows };
}

// Per-fight skill-cast timeline (dps.report's "Rotations" tab). Reads
// player.rotation[] = [{ id, skills: [{castTime, duration, ...}] }] straight
// from the raw log (confirmed against EI's JsonRotation/JsonSkill JSON doc).
function computeRotations(fights: FightInput[]): RotationsData {
  type SkillCast = { castTime?: number; duration?: number };
  type RotEntry = { id?: number; skills?: SkillCast[] };

  const skillMeta: Record<number, { name: string; icon?: string }> = {};
  const fightRows: RotationsData['fights'] = [];

  fights.forEach((f, idx) => {
    const raw = f.raw as Record<string, unknown>;
    const skillMap = (raw.skillMap ?? {}) as Record<string, { name?: string; icon?: string }>;
    for (const key of Object.keys(skillMap)) {
      const id = Number(key.replace(/^s/, ''));
      const def = skillMap[key];
      if (Number.isFinite(id) && def?.name && !skillMeta[id]) {
        skillMeta[id] = { name: def.name, icon: def.icon };
      }
    }

    const durationMs = Number(raw.durationMS) || 0;
    if (durationMs <= 0) return;

    const players = (raw.players ?? []) as Record<string, unknown>[];
    const rotPlayers: RotationsData['fights'][number]['players'] = [];
    for (const p of players) {
      if (p.notInSquad) continue;
      const account = typeof p.account === 'string' ? p.account : null;
      if (!account) continue;
      const rotation = (p.rotation ?? []) as RotEntry[];
      const casts: { skillId: number; castTime: number; duration: number }[] = [];
      for (const entry of rotation) {
        const skillId = Number(entry?.id);
        if (!Number.isFinite(skillId)) continue;
        for (const skill of entry.skills ?? []) {
          const castTime = Number(skill?.castTime) || 0;
          casts.push({ skillId, castTime, duration: Number(skill?.duration) || 0 });
        }
      }
      if (casts.length === 0) continue;
      casts.sort((a, b) => a.castTime - b.castTime);
      rotPlayers.push({
        account,
        profession: String(p.profession || 'Unknown'),
        professionList: [],
        casts,
      });
    }

    if (rotPlayers.length > 0) {
      fightRows.push({
        fightId: f.summary.permalink || `${f.summary.fightName}-${idx}`,
        fightName: f.summary.fightName || `Fight ${idx + 1}`,
        durationMs,
        players: rotPlayers,
      });
    }
  });

  return { skillMeta, fights: fightRows };
}

// Per-fight cumulative-damage-over-time series (dps.report's "Graph" tab).
// Reads player.damage1S[phase][second] straight from the raw log (confirmed
// against EI's JsonActor.Damage1S JSON doc - phase 0 = full fight, one
// cumulative int per second of the fight).
function computeDpsGraph(fights: FightInput[]): DpsGraphData {
  const fightRows: DpsGraphData['fights'] = [];

  fights.forEach((f, idx) => {
    const raw = f.raw as Record<string, unknown>;
    const durationMs = Number(raw.durationMS) || 0;
    if (durationMs <= 0) return;

    const players = (raw.players ?? []) as Record<string, unknown>[];
    const series: DpsGraphData['fights'][number]['players'] = [];
    let maxLen = 0;

    for (const p of players) {
      if (p.notInSquad) continue;
      const account = typeof p.account === 'string' ? p.account : null;
      if (!account) continue;
      const damage1S = (p.damage1S ?? []) as number[][];
      const points = (damage1S[0] ?? []).map((v) => Number(v) || 0);
      if (points.length === 0) continue;
      maxLen = Math.max(maxLen, points.length);
      series.push({ account, profession: String(p.profession || 'Unknown'), points });
    }

    if (series.length === 0) return;

    const squad = new Array(maxLen).fill(0);
    for (const s of series) {
      let last = 0;
      for (let i = 0; i < maxLen; i++) {
        const v = i < s.points.length ? s.points[i] : last;
        last = v;
        squad[i] += v;
      }
    }

    fightRows.push({
      fightId: f.summary.permalink || `${f.summary.fightName}-${idx}`,
      fightName: f.summary.fightName || `Fight ${idx + 1}`,
      durationMs,
      squad,
      players: series,
    });
  });

  return { fights: fightRows };
}

// Aggregates per-skill outgoing/incoming damage across all fights, straight from
// Elite Insights' raw totalDamageDist / totalDamageTaken breakdowns (phase 0 =
// full fight). Each totalDamageDist entry also carries a per-skill
// `downContribution` field (the same field the vendored bridge-metrics code
// reads for the player-level total in combatMetrics.ts) - down contribution is
// an outgoing-damage concept, so it's only accumulated for outgoing skills.
function computeTopSkills(fights: FightInput[]): { topSkills: TopSkill[]; topIncomingSkills: TopSkill[] } {
  const skillMeta = new Map<number, { name: string; icon?: string }>();
  const outgoing = new Map<number, { damage: number; hits: number; downContribution: number }>();
  const incoming = new Map<number, { damage: number; hits: number; downContribution: number }>();

  function accumulate(
    target: Map<number, { damage: number; hits: number; downContribution: number }>,
    id: number,
    damage: number,
    hits: number,
    downContribution: number
  ) {
    const cur = target.get(id) || { damage: 0, hits: 0, downContribution: 0 };
    cur.damage += damage;
    cur.hits += hits;
    cur.downContribution += downContribution;
    target.set(id, cur);
  }

  type DistEntry = { id?: number; totalDamage?: number; connectedHits?: number; hits?: number; downContribution?: number };

  for (const f of fights) {
    const raw = f.raw as Record<string, unknown>;
    const skillMap = (raw.skillMap ?? {}) as Record<string, { name?: string; icon?: string }>;
    for (const key of Object.keys(skillMap)) {
      const def = skillMap[key];
      const id = Number(key.replace(/^s/, ''));
      if (Number.isFinite(id) && def?.name && !skillMeta.has(id)) {
        skillMeta.set(id, { name: def.name, icon: def.icon });
      }
    }

    const players = (raw.players ?? []) as Record<string, unknown>[];
    for (const p of players) {
      if (p.notInSquad) continue;

      const outDist = (p.totalDamageDist ?? []) as DistEntry[][];
      for (const entry of outDist[0] ?? []) {
        const id = Number(entry?.id);
        if (!Number.isFinite(id)) continue;
        const dmg = Number(entry?.totalDamage) || 0;
        const hits = Number(entry?.connectedHits ?? entry?.hits) || 0;
        const downContrib = Number(entry?.downContribution) || 0;
        if (dmg === 0 && hits === 0 && downContrib === 0) continue;
        accumulate(outgoing, id, dmg, hits, downContrib);
      }

      const inDist = (p.totalDamageTaken ?? []) as DistEntry[][];
      for (const entry of inDist[0] ?? []) {
        const id = Number(entry?.id);
        if (!Number.isFinite(id)) continue;
        const dmg = Number(entry?.totalDamage) || 0;
        const hits = Number(entry?.connectedHits ?? entry?.hits) || 0;
        if (dmg === 0 && hits === 0) continue;
        accumulate(incoming, id, dmg, hits, 0);
      }
    }
  }

  function toTopSkills(map: Map<number, { damage: number; hits: number; downContribution: number }>): TopSkill[] {
    return Array.from(map.entries())
      .map(([id, v]) => ({
        name: skillMeta.get(id)?.name ?? `Skill ${id}`,
        icon: id,
        damage: v.damage,
        hits: v.hits,
        downContribution: v.downContribution,
      }))
      .filter((s) => s.damage > 0 || s.hits > 0)
      .sort((a, b) => b.damage - a.damage)
      .slice(0, 30);
  }

  return { topSkills: toTopSkills(outgoing), topIncomingSkills: toTopSkills(incoming) };
}

// Per-fight 2D scrubbable replay data, promoted into the combined report so
// Fight Replay is a first-class sidebar page instead of only being reachable
// via a small icon on individual upload-queue rows before a report exists.
function computeReplayFights(fights: FightInput[]) {
  const rows: { fightId: string; fightName: string; data: NonNullable<ReturnType<typeof parseReplayData>> }[] = [];
  fights.forEach((f, idx) => {
    const data = parseReplayData(f.raw);
    if (!data) return;
    rows.push({
      fightId: f.summary.permalink || `${f.summary.fightName}-${idx}`,
      fightName: f.summary.fightName || `Fight ${idx + 1}`,
      data,
    });
  });
  return rows;
}

function severityRank(sev: string): number {
  const m = /Sev(\d)/.exec(sev);
  return m ? Number(m[1]) : 0;
}

// Per-fight boss/encounter mechanic event markers (dps.report's "Mechanics"
// tab). Reads raw.mechanics[] = [{ name, fullName, description, severity,
// mechanicsData: [{ time, actor, id, instid, weight }] }] straight from the
// raw log (confirmed against EI's JsonLog.Mechanics / JsonMechanics /
// JsonMechanic JSON doc - JsonMechanic.Id is the species id of the actor
// that triggered the event, 0 meaning the actor was a player). Player
// events are resolved to a squad account via the fight's own player list
// (matched on character name, the only identifier the mechanic event
// carries).
function computeMechanicsTimeline(fights: FightInput[]): MechanicsData {
  type RawMechanicEvent = { time?: number; actor?: string; id?: number; instid?: number; weight?: number };
  type RawMechanic = { name?: string; fullName?: string; description?: string; severity?: string; mechanicsData?: RawMechanicEvent[] };

  const fightRows: MechanicsData['fights'] = [];

  fights.forEach((f, idx) => {
    const raw = f.raw as Record<string, unknown>;
    const durationMs = Number(raw.durationMS) || 0;
    if (durationMs <= 0) return;

    const rawMechanics = (raw.mechanics ?? []) as RawMechanic[];
    if (!Array.isArray(rawMechanics) || rawMechanics.length === 0) return;

    const players = (raw.players ?? []) as Record<string, unknown>[];
    const nameToAccount = new Map<string, string>();
    for (const p of players) {
      const name = typeof p.name === 'string' ? p.name : null;
      const account = typeof p.account === 'string' ? p.account : null;
      if (name && account) nameToAccount.set(name, account);
    }

    const mechanics: MechanicsData['fights'][number]['mechanics'] = [];
    rawMechanics.forEach((m, mIdx) => {
      const data = Array.isArray(m.mechanicsData) ? m.mechanicsData : [];
      if (data.length === 0) return;
      const events = data
        .map((e) => {
          const actor = typeof e.actor === 'string' && e.actor ? e.actor : 'Unknown';
          const isPlayer = Number(e.id) === 0;
          const account = isPlayer ? nameToAccount.get(actor) : undefined;
          return { time: Number(e.time) || 0, actor, account, isPlayer };
        })
        .sort((a, b) => a.time - b.time);

      mechanics.push({
        key: `${m.name ?? 'mech'}-${mIdx}`,
        def: {
          name: m.name || `Mechanic ${mIdx + 1}`,
          fullName: m.fullName || m.name || `Mechanic ${mIdx + 1}`,
          description: m.description,
          severity: m.severity || 'Sev0',
        },
        events,
      });
    });

    if (mechanics.length === 0) return;
    // Most severe, most frequent mechanics first so the panel opens on the
    // interesting stuff instead of an alphabetical wall.
    mechanics.sort(
      (a, b) => severityRank(b.def.severity) - severityRank(a.def.severity) || b.events.length - a.events.length
    );

    fightRows.push({
      fightId: f.summary.permalink || `${f.summary.fightName}-${idx}`,
      fightName: f.summary.fightName || `Fight ${idx + 1}`,
      durationMs,
      mechanics,
    });
  });

  return { fights: fightRows };
}

// Automated squad-composition/performance insight flags, computed entirely
// from data Entropy already derives elsewhere (boon uptime, role
// classification, K/D) - the kind of "what should we fix next raid" read
// that raw dps.report/EI output doesn't surface on its own.
function computeSynergyInsights(
  playerEntries: PlayerStats[],
  buffCategoryUptimes: Record<string, BoonUptimeData>,
  roleClassifications: RoleClassification[],
  totalSquadKills: number,
  totalSquadDeaths: number,
  avgSquadSize: number,
): SynergyInsight[] {
  const insights: SynergyInsight[] = [];
  const boons = buffCategoryUptimes['Boons'];

  function avgUptime(boonName: string): number | null {
    if (!boons) return null;
    const col = boons.columns.find((c) => c.name === boonName);
    if (!col) return null;
    const withData = boons.rows.filter((r) => r.uptimes[col.id] !== undefined);
    if (withData.length === 0) return null;
    return withData.reduce((sum, r) => sum + (r.uptimes[col.id] || 0), 0) / withData.length;
  }

  const quickness = avgUptime('Quickness');
  if (quickness !== null) {
    if (quickness < 20) {
      insights.push({ id: 'quickness', severity: 'critical', title: 'Very low Quickness uptime', detail: `Squad averaged only ${quickness.toFixed(0)}% Quickness uptime - DPS is likely being left on the table without a dedicated quickness support.` });
    } else if (quickness < 50) {
      insights.push({ id: 'quickness', severity: 'warn', title: 'Low Quickness uptime', detail: `Squad averaged ${quickness.toFixed(0)}% Quickness uptime, below the ~70%+ a coordinated squad usually holds.` });
    } else {
      insights.push({ id: 'quickness', severity: 'good', title: 'Solid Quickness uptime', detail: `Squad averaged ${quickness.toFixed(0)}% Quickness uptime.` });
    }
  }

  const alacrity = avgUptime('Alacrity');
  if (alacrity !== null) {
    if (alacrity < 20) {
      insights.push({ id: 'alacrity', severity: 'warn', title: 'Very low Alacrity uptime', detail: `Squad averaged only ${alacrity.toFixed(0)}% Alacrity uptime.` });
    } else if (alacrity >= 50) {
      insights.push({ id: 'alacrity', severity: 'good', title: 'Solid Alacrity uptime', detail: `Squad averaged ${alacrity.toFixed(0)}% Alacrity uptime.` });
    }
  }

  const stability = avgUptime('Stability');
  if (stability !== null) {
    if (stability < 15) {
      insights.push({ id: 'stability', severity: 'critical', title: 'Very low Stability uptime', detail: `Squad averaged only ${stability.toFixed(0)}% Stability uptime - vulnerable to CC chains and pulls/knockbacks.` });
    } else if (stability < 30) {
      insights.push({ id: 'stability', severity: 'warn', title: 'Low Stability uptime', detail: `Squad averaged ${stability.toFixed(0)}% Stability uptime.` });
    }
  }

  const supportCount = roleClassifications.filter((r) => r.role === 'support').length;
  const damageCount = roleClassifications.filter((r) => r.role === 'damage').length;
  if (playerEntries.length >= 5) {
    if (supportCount === 0) {
      insights.push({ id: 'no-support', severity: 'critical', title: 'No dedicated support detected', detail: 'No player was classified into a support role this session - the squad may have been running without a healer/boon support.' });
    } else if (supportCount / Math.max(1, playerEntries.length) < 0.15) {
      insights.push({ id: 'thin-support', severity: 'warn', title: 'Thin support coverage', detail: `Only ${supportCount} of ${playerEntries.length} tracked players were classified as support, against ${damageCount} damage.` });
    } else {
      insights.push({ id: 'support-ratio', severity: 'good', title: 'Healthy support ratio', detail: `${supportCount} of ${playerEntries.length} tracked players were classified as support.` });
    }
  }

  if (totalSquadDeaths > 0 && totalSquadKills > 0) {
    const kdr = totalSquadKills / totalSquadDeaths;
    if (kdr < 1) {
      insights.push({ id: 'kdr', severity: 'warn', title: 'Trading down', detail: `Squad K/D was ${kdr.toFixed(2)} - taking more deaths than kills across these fights.` });
    } else if (kdr >= 3) {
      insights.push({ id: 'kdr', severity: 'good', title: 'Strong trading', detail: `Squad K/D was ${kdr.toFixed(2)} across these fights.` });
    }
  }

  const heavyDownPlayers = playerEntries.filter((s) => s.totalFightMs > 0 && s.downs >= 3);
  if (heavyDownPlayers.length > 0) {
    const names = heavyDownPlayers.slice(0, 3).map((s) => s.account).join(', ');
    insights.push({ id: 'heavy-downs', severity: 'warn', title: 'Repeated downs on a few players', detail: `${names}${heavyDownPlayers.length > 3 ? ` +${heavyDownPlayers.length - 3} more` : ''} were downed 3+ times - worth checking positioning or focus-fire priority on them.` });
  }

  if (avgSquadSize > 0 && avgSquadSize < 5) {
    insights.push({ id: 'small-squad', severity: 'info', title: 'Small squad size', detail: `Average squad size was ${avgSquadSize} - some stats (role balance, boon coverage) are noisier with fewer players.` });
  }

  return insights;
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

  const buffCategoryUptimes = computeBuffCategoryUptimes(fights, playerEntries);

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
    maxDownContrib: getTop(leaderboards.downContrib, playerEntries),
    maxBarrier: getTop(leaderboards.barrier, playerEntries),
    maxHealing: getTop(leaderboards.healing, playerEntries),
    maxDodges: getTop(leaderboards.dodges, playerEntries),
    maxStrips: getTop(leaderboards.strips, playerEntries),
    maxCleanses: getTop(leaderboards.cleanses, playerEntries),
    maxCC: getTop(leaderboards.cc, playerEntries),
    maxInterrupts: getTop(leaderboards.interrupts, playerEntries),
    maxCCAndInterrupts: getTop(leaderboards.ccAndInterrupts, playerEntries),
    maxStab: getTop(leaderboards.stability, playerEntries),
    closestToTag: getTop(leaderboards.closestToTag, playerEntries),
    ...computeTopSkills(fights),
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
    boonUptimes: buffCategoryUptimes['Boons'] ?? { columns: [], rows: [] },
    buffCategoryUptimes,
    damageModifiers: computeDamageModifiers(fights),
    rotations: computeRotations(fights),
    dpsGraph: computeDpsGraph(fights),
    replayFights: computeReplayFights(fights),
    synergyInsights: computeSynergyInsights(playerEntries, buffCategoryUptimes, roleClassifications, totalSquadKills, totalSquadDeaths, avgSquadSize),
    mechanics: computeMechanicsTimeline(fights),
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
      trimmedSections: ['fightBreakdown', 'commanderStats', 'mapData', 'timelineData', 'boonTables'],
    },
    stats,
  };
}
