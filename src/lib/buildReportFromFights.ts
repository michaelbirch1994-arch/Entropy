// Turns a set of raw Elite Insights fight logs (as fetched from dps.report by
// RawLogImporter) into a full Entropy WvWReport: leaderboards, MVP scoring,
// role classification wiring, squad/enemy class breakdowns, attendance, and
// derived dashboard metrics.
//
// Deliberately out of scope for this pass (left as empty defaults so the
// interface stays satisfied without crashing any view): per-fight breakdown
// table, commander stats, boon generation tables/leaderboards, map/timeline
// data. These require additional Entropy-native ingestion and UI passes.

import { computePlayerAggregation, getFightDownsDeaths, type PlayerStats } from './bridge-metrics/computePlayerAggregation';
import type { HealingCoverage, PlayerSkillBreakdown, PlayerSkillSource } from '../types/report';
import { computeAllIncomingHealing, type IncomingHealingBreakdown } from './bridge-metrics/incomingHealing';
import { normalizeDeathEvents } from './combat/normalizeDeaths';
import { detectFailedRecoveries, detectMassDowns } from './intelligence/criticalEvents';
import { detectSquadSeparations } from './intelligence/squadSeparation';
import { segmentEngagements } from './intelligence/segmentation';
import { synthesizeFindings } from './intelligence/findingEngine';
import type { CombatEvent } from './combat/CombatEvent';
import type { CriticalEvent, IntelligenceFinding } from './intelligence/types';
import type { EngagementSegment } from './intelligence/engagementTypes';
import { computeDistanceToTag } from './bridge-metrics/distanceToTag';

/**
 * Merge per-log incoming-healing breakdowns into one per player.
 *
 * Totals add across fights. Confidence and coverage take the WORST value seen, so
 * one badly-reconciling log downgrades the whole session rather than being averaged
 * away — a session is only as trustworthy as its weakest source.
 */
function mergeSurvivalSupport(perLog: IncomingHealingBreakdown[][]): IncomingHealingBreakdown[] {
    const rank = { high: 3, medium: 2, low: 1, none: 0 } as const;
    const covRank = { full: 2, partial: 1, none: 0 } as const;
    const byAccount = new Map<string, IncomingHealingBreakdown>();

  for (const log of perLog) {
        for (const bd of log) {
                const existing = byAccount.get(bd.account);
                if (!existing) { byAccount.set(bd.account, { ...bd, contributors: bd.contributors.map((c) => ({ ...c })) }); continue; }
                existing.healed += bd.healed;
                existing.healingPowerHealed += bd.healingPowerHealed;
                existing.conversionHealed += bd.conversionHealed;
                existing.hybridHealed += bd.hybridHealed;
                existing.downedHealed += bd.downedHealed;
                existing.barrier += bd.barrier;
                existing.unattributed += bd.unattributed;
                if (rank[bd.attributionConfidence] < rank[existing.attributionConfidence]) {
                          existing.attributionConfidence = bd.attributionConfidence;
                          existing.attributionNote = bd.attributionNote;
                }
                if (covRank[bd.coverage] < covRank[existing.coverage]) existing.coverage = bd.coverage;
                for (const c of bd.contributors) {
                          const hit = existing.contributors.find((x) => x.account === c.account);
                          if (hit) hit.healing += c.healing;
                          else existing.contributors.push({ ...c });
                }
        }
  }

  for (const bd of byAccount.values()) {
        // Recompute shares against the merged total, and drop the split entirely if
      // any log in the session failed reconciliation.
      if (bd.attributionConfidence === 'none') bd.contributors = [];
        for (const c of bd.contributors) c.share = bd.healed > 0 ? c.healing / bd.healed : 0;
        bd.contributors.sort((a, b) => b.healing - a.healing);
        bd.contributorsAvailable = bd.contributors.length > 0;
  }
    return [...byAccount.values()].sort((a, b) => b.healed - a.healed);
}

function topPlayerSources<T>(
    map: Map<string, T>,
    valueKey: keyof T,
    limit = 5,
): PlayerSkillSource[] {
    return Array.from(map.values())
        .map((entry: any) => ({
            id: String(entry.id ?? ''),
            name: String(entry.name ?? 'Unknown Skill'),
            icon: entry.icon,
            value: Number(entry[valueKey] ?? entry.total ?? 0),
            hits: Number(entry.hits ?? 0),
            downContribution: Number(entry.downContribution ?? 0),
        }))
        .filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
}

function serializePlayerSkillBreakdowns(
    agg: ReturnType<typeof computePlayerAggregation>,
): Record<string, PlayerSkillBreakdown> {
    const out: Record<string, PlayerSkillBreakdown> = {};

    for (const bd of agg.playerSkillBreakdownMap.values()) {
        const key = bd.profession && bd.profession !== 'Unknown' ? `${bd.account}::${bd.profession}` : bd.account;
        out[key] = {
            account: bd.account,
            profession: bd.profession,
            professionList: bd.professionList,
            damage: topPlayerSources(bd.skills, 'damage'),
            healing: [],
            barrier: [],
        };
        if (!out[bd.account]) out[bd.account] = out[key];
    }

    for (const bd of agg.healingBreakdownMap.values()) {
        const key = bd.profession && bd.profession !== 'Unknown' ? `${bd.account}::${bd.profession}` : bd.account;
        const existing = out[key] ?? {
            account: bd.account,
            profession: bd.profession,
            professionList: bd.professionList,
            damage: [],
            healing: [],
            barrier: [],
        };
        existing.healing = topPlayerSources(bd.healingSkills, 'total');
        existing.barrier = topPlayerSources(bd.barrierSkills, 'total');
        out[key] = existing;
        if (!out[bd.account]) out[bd.account] = existing;
    }

    return out;
}

function cleanMitigationTotals(totals: any) {
    return {
        totalHits: Number(totals?.totalHits ?? 0),
        blocked: Number(totals?.blocked ?? 0),
        evaded: Number(totals?.evaded ?? 0),
        glanced: Number(totals?.glanced ?? 0),
        missed: Number(totals?.missed ?? 0),
        invulned: Number(totals?.invulned ?? 0),
        interrupted: Number(totals?.interrupted ?? 0),
        totalMitigation: Number(totals?.totalMitigation ?? 0),
        minMitigation: Number(totals?.minMitigation ?? 0),
        isEstimated: Boolean(totals?.isEstimated),
    };
}

function hasMitigationValue(row: { mitigationTotals: ReturnType<typeof cleanMitigationTotals> }) {
    const totals = row.mitigationTotals;
    return totals.totalHits > 0
        || totals.totalMitigation > 0
        || totals.blocked > 0
        || totals.evaded > 0
        || totals.glanced > 0
        || totals.missed > 0
        || totals.invulned > 0
        || totals.interrupted > 0;
}

function serializeDamageMitigationPlayers(
    agg: ReturnType<typeof computePlayerAggregation>,
): DamageMitigationPlayer[] {
    return Array.from(agg.damageMitigationPlayersMap.values())
        .map((row) => ({
            account: row.account,
            name: row.name,
            profession: row.profession,
            professionList: row.professionList ?? [],
            activeMs: Number(row.activeMs ?? 0),
            mitigationTotals: cleanMitigationTotals(row.mitigationTotals),
        }))
        .filter(hasMitigationValue)
        .sort((a, b) => b.mitigationTotals.totalMitigation - a.mitigationTotals.totalMitigation || a.account.localeCompare(b.account));
}

function serializeDamageMitigationMinions(
    agg: ReturnType<typeof computePlayerAggregation>,
): DamageMitigationMinion[] {
    return Array.from(agg.damageMitigationMinionsMap.values())
        .map((row) => ({
            account: row.account,
            name: row.name,
            profession: row.profession,
            professionList: row.professionList ?? [],
            activeMs: Number(row.activeMs ?? 0),
            mitigationTotals: cleanMitigationTotals(row.mitigationTotals),
            minion: row.minion,
        }))
        .filter(hasMitigationValue)
        .sort((a, b) => b.mitigationTotals.totalMitigation - a.mitigationTotals.totalMitigation || a.account.localeCompare(b.account));
}

/**
 * Classify how complete a player's healing figures are.
 *
 * Guarding against the most misleading case Entropy can produce: a player with no
 * heal addon whose healing happened to land on addon-running allies shows a real
 * but incomplete number, and one whose healing landed nowhere observable shows a
 * zero that actually means "unknown". Neither may be presented as a total.
 */
function resolveHealingCoverage(hasHealAddon: boolean, healing: number): HealingCoverage {
    if (hasHealAddon) return 'full';
    return healing > 0 ? 'partial' : 'none';
}
import { buildBoonTables, type BoonTable, BUFF_CLASSIFICATIONS } from './bridge-metrics/boonGeneration';
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
  CommanderRow,
  FightRow,
  TimelinePoint,
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
    TopHealingSource,
    TopBarrierSource,
    DeathRecapEntry,
    FightHighlight,
    DamageMitigationPlayer,
    DamageMitigationMinion,
} from '../types/report';

import { getFightOutcome } from "./bridge-metrics/computePlayerAggregation";
// Stamped onto every report. Metrics are computed at build time, not at
// display time, so a report built by an older version keeps whatever numbers
// that version produced - updating the app does not retroactively fix it.
// Bump this whenever a change alters computed output, so the UI can tell the
// user to re-import instead of silently showing them stale figures.
export const METRICS_VERSION = 'entropy-raw-v7';

const NATURAL_FORTITUDE_SYNTHETIC_SKILL_ID = -1001779;
const NATURAL_FORTITUDE_DAMAGE_PER_UNLEASHED_SKILL_HIT = 1779;
const NATURAL_FORTITUDE_TRAIT_NAME = 'Natural Fortitude';
const NATURAL_FORTITUDE_TRAIT_ICON = 'https://wiki.guildwars2.com/wiki/Special:FilePath/Natural%20Fortitude.png';
const NATURAL_FORTITUDE_TRIGGER_SKILLS: Record<string, { divisor: number }> = {
    'Savage Slash': { divisor: 1 },
    'Solar Brilliance': { divisor: 6 },
    'Relentless Whirl': { divisor: 5 },
    'Rampant Growth': { divisor: 1 },
};

export interface FightInput {
    summary: RawFightSummary;
    raw: RawFightLog;
}

// --- MVP weight table ---

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

interface NaturalFortitudeDamageAdjustment {
    hits: number;
    damage: number;
    byPlayerKey: Map<string, { hits: number; damage: number }>;
    fightDamage: number[];
}

function addNaturalFortitudeDamageToPlayer(stat: PlayerStats, damage: number, hits: number) {
    if (damage <= 0) return;

    stat.damage += damage;
    stat.damageAll += damage;
    stat.offenseTotals.damage = Number(stat.offenseTotals.damage || 0) + damage;
    stat.offenseTotals.damageAll = Number(stat.offenseTotals.damageAll || 0) + damage;
    stat.offenseTotals.directDmg = Number(stat.offenseTotals.directDmg || 0) + damage;
    stat.offenseTotals.connectedDamageCount = Number(stat.offenseTotals.connectedDamageCount || 0) + hits;
    stat.dps = stat.totalFightMs > 0 ? stat.damage / (stat.totalFightMs / 1000) : 0;
    stat.dpsAll = stat.totalFightMs > 0 ? stat.damageAll / (stat.totalFightMs / 1000) : 0;
}

function resolveRawPlayerAggregationKey(player: Record<string, unknown>): string {
    const account = typeof player.account === 'string' && player.account !== 'Unknown'
      ? player.account
      : typeof player.name === 'string'
        ? player.name
        : 'Unknown';
    // Natural Fortitude is attributed to the person, not to a fight-local
    // account+profession row. This keeps its synthetic damage attached when an
    // account changes character or specialization during a combined report.
    return account;
}

function computeNaturalFortitudeDamage(fights: FightInput[]): NaturalFortitudeDamageAdjustment {
    type DistEntry = { id?: number; connectedHits?: number; hits?: number };

    const result: NaturalFortitudeDamageAdjustment = {
        hits: 0,
        damage: 0,
        byPlayerKey: new Map(),
        fightDamage: [],
    };

    for (const f of fights) {
        const raw = f.raw as Record<string, unknown>;
        const skillMap = (raw.skillMap ?? {}) as Record<string, { name?: string }>;
        const triggerSkillIds = new Map<number, { divisor: number }>();

        for (const key of Object.keys(skillMap)) {
            const id = Number(key.replace(/^s/, ''));
            const name = String(skillMap[key]?.name || '').trim();
            const rule = NATURAL_FORTITUDE_TRIGGER_SKILLS[name];
            if (Number.isFinite(id) && rule) {
                triggerSkillIds.set(id, rule);
            }
        }

        if (triggerSkillIds.size === 0) continue;

        const players = (raw.players ?? []) as Record<string, unknown>[];
        let fightHits = 0;
        for (const p of players) {
            if (p.notInSquad || String(p.profession || '') !== 'Untamed') continue;
            const outDist = (p.totalDamageDist ?? []) as DistEntry[][];
            let playerHits = 0;

            for (const entry of outDist[0] ?? []) {
                const id = Number(entry?.id);
                if (!Number.isFinite(id)) continue;
                const rule = triggerSkillIds.get(id);
                if (!rule) continue;
                const hits = Number(entry?.connectedHits ?? entry?.hits) || 0;
                if (hits <= 0) continue;
                playerHits += Math.floor(hits / rule.divisor);
            }

            if (playerHits <= 0) continue;

            const damage = playerHits * NATURAL_FORTITUDE_DAMAGE_PER_UNLEASHED_SKILL_HIT;
            const playerKey = resolveRawPlayerAggregationKey(p);
            const cur = result.byPlayerKey.get(playerKey) || { hits: 0, damage: 0 };
            cur.hits += playerHits;
            cur.damage += damage;
            result.byPlayerKey.set(playerKey, cur);
            result.hits += playerHits;
            result.damage += damage;
            fightHits += playerHits;
        }
        if (fightHits > 0) {
            result.fightDamage.push(fightHits * NATURAL_FORTITUDE_DAMAGE_PER_UNLEASHED_SKILL_HIT);
        }
    }

    return result;
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
//
// Imported from boonGeneration.ts rather than defined here: this used to be
// duplicated, and Buff Generation's own (now-removed) copy of the same idea
// silently only recognized 'Boon', so the two pages drifted - Buff Generation
// never gained the categories the Buffs page did. One map now, shared by both.

// Computes an uptime table (like computeBoonUptimes used to, single-category)
// for every EI buff classification in one pass over the fights, so the Buffs
// view can offer the full set of dps.report-style tabs instead of just Boons.
function computeBuffCategoryUptimes(fights: FightInput[], playerEntries: PlayerStats[]): Record<string, BoonUptimeData> {
    const buffMetaByClass = new Map<string, Map<number, { name: string; icon?: string; stacking: boolean }>>();
    const accByClass = new Map<string, Map<string, Map<number, { sum: number; count: number }>>>();
    const groupByAccount = new Map<string, number>();

  for (const cls of Object.keys(BUFF_CLASSIFICATIONS)) {
        buffMetaByClass.set(cls, new Map());
        accByClass.set(cls, new Map());
  }

  for (const f of fights) {
        const raw = f.raw as Record<string, unknown>;
        const buffMap = (raw.buffMap ?? {}) as Record<string, { name?: string; icon?: string; classification?: string; stacking?: boolean }>;
        const idToClass = new Map<number, string>();
        for (const key of Object.keys(buffMap)) {
                const def = buffMap[key];
                const cls = def?.classification;
                if (def && cls && BUFF_CLASSIFICATIONS[cls]) {
                          const id = Number(key.replace(/^b/, ''));
                          if (!Number.isFinite(id)) continue;
                          idToClass.set(id, cls);
                          const meta = buffMetaByClass.get(cls)!;
                          // EI's BuffDesc.stacking distinguishes intensity-stacking buffs
          // (Might, Stability, every condition) from duration-stacking ones.
          // It decides whether this buff's `uptime` value is a percentage or
          // an average stack count - see the note on BoonUptimeColumn.stacking.
                          if (!meta.has(id)) {
                              const name = def.name || `Buff ${id}`;
                              meta.set(id, {
                                  name,
                                  icon: def.icon,
                                  stacking: !!def.stacking,
                              });
                          }
                }
        }

      // Uptimes are averaged as a plain mean across the fights each player
      // joined, with every player listed - matching how EI and dps.report
      // report them, so a column here reconciles against theirs. A previous
      // version weighted by time in combat and hid players under 25% active,
      // which handled squad-wide averages better but no longer lined up with
      // either tool.

      const players = (raw.players ?? []) as Record<string, unknown>[];
        for (const p of players) {
                if (p.notInSquad) continue;
                const account = typeof p.account === 'string' ? p.account : null;
                if (!account) continue;
                if (typeof p.group === 'number') groupByAccount.set(account, p.group);


          const buffUptimes = (p.buffUptimes ?? []) as Array<{ id?: number; buffData?: Array<{ uptime?: number; presence?: number }> }>;
          const fightBuffValues = new Map<number, number>();
                for (const entry of buffUptimes) {
                          const id = Number(entry?.id);
                          if (!Number.isFinite(id)) continue;
                          const cls = idToClass.get(id);
                          if (!cls) continue;
                          const meta = buffMetaByClass.get(cls)?.get(id);
                          const uptime = Number(entry?.buffData?.[0]?.uptime);
                          if (!Number.isFinite(uptime)) continue;
                          // EI normally emits one phase-0 uptime row per buff, but
                          // defensive test fixtures and some transformed logs may
                          // carry duplicate ids. Treat the last row for a buff as
                          // the fight-level value and add it once below, instead of
                          // averaging duplicate rows inside the same fight.
                          fightBuffValues.set(id, uptime);
                }

                fightBuffValues.forEach((uptime, id) => {
                          const cls = idToClass.get(id);
                          if (!cls) return;

                  const accMapByAccount = accByClass.get(cls)!;
                          let accMap = accMapByAccount.get(account);
                          if (!accMap) { accMap = new Map(); accMapByAccount.set(account, accMap); }
                          const cur = accMap.get(id) || { sum: 0, count: 0 };
                          // A plain mean across the fights a player joined, and every player is
                  // listed - this is deliberately the same methodology EI and dps.report
                  // use, so a column here can be read side by side with theirs. An
                  // earlier version weighted each fight by time in combat and dropped
                  // low-activity players, which was arguably a truer squad average but
                  // meant the numbers no longer reconciled with either tool.
                  cur.sum += uptime;
                          cur.count += 1;
                          accMap.set(id, cur);
                });
        }
  }

  const result: Record<string, BoonUptimeData> = {};
    for (const cls of Object.keys(BUFF_CLASSIFICATIONS)) {
          const buffMeta = buffMetaByClass.get(cls)!;
          const acc = accByClass.get(cls)!;

      const columns: BoonUptimeColumn[] = Array.from(buffMeta.entries())
            .map(([id, meta]) => ({ id, name: meta.name, icon: meta.icon, stacking: meta.stacking }))
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
  const rowsByKey = new Map<string, { account: string; profession: string; professionList: string[]; group: number; fightsJoined: number; activeMs: number; seenFights: Set<number>; values: Map<number, { damage: number; hits: number }> }>();

  for (const [fightIndex, f] of fights.entries()) {
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
                          row = { account, profession, professionList: [], group: Number(p.group) || 0, fightsJoined: 0, activeMs: 0, seenFights: new Set(), values: new Map() };
                          rowsByKey.set(rowKey, row);
                }
                if (!row.seenFights.has(fightIndex)) {
                          row.seenFights.add(fightIndex);
                          row.fightsJoined += 1;
                          const activeTimes = p.activeTimes as unknown;
                          const activeMs = Array.isArray(activeTimes) && typeof activeTimes[0] === 'number'
                            ? activeTimes[0]
                            : Number(raw.durationMS) || 0;
                          row.activeMs += Math.max(0, activeMs);
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
              return { account: row.account, profession: row.profession, professionList: row.professionList, group: row.group, fightsJoined: row.fightsJoined, activeMs: row.activeMs, values };
      })
      .filter((row) => Object.keys(row.values).length > 0)
      .sort((a, b) => a.group - b.group || a.account.localeCompare(b.account) || a.profession.localeCompare(b.profession));

  return { columns, rows, totalFights: fights.length };
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
        // Which skill ids actually dealt damage in this fight, taken from EI's own
                     // per-player totalDamageDist. Cast timelines include everything a player
                     // pressed - weapon swaps, dodges, resurrects, pure heals, utility - none of
                     // which belong in a "what caused this DPS spike" breakdown. Intersecting
                     // casts against this set keeps the spike view to skills that could have
                     // produced the damage being explained.
                     const damagingSkillIds = new Set<number>();
        for (const p of players) {
                if (p.notInSquad) continue;
                const dmgDist = ((p.totalDamageDist ?? []) as Array<Array<{ id?: number; totalDamage?: number }>>)[0] ?? [];
                for (const e of dmgDist) {
                          const sid = Number(e?.id);
                          if (Number.isFinite(sid) && (Number(e?.totalDamage) || 0) > 0) damagingSkillIds.add(sid);
                }
        }
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
                          activeMs: (() => {
                                    const activeTimes = p.activeTimes as unknown;
                                    const value = Array.isArray(activeTimes) && typeof activeTimes[0] === 'number'
                                      ? activeTimes[0]
                                      : durationMs;
                                    return Math.max(0, value);
                          })(),
                          casts,
                });
        }

                     if (rotPlayers.length > 0) {
                             fightRows.push({
                                       fightId: f.summary.permalink || `${f.summary.fightName}-${idx}`,
                                       fightName: f.summary.fightName || `Fight ${idx + 1}`,
                                       durationMs,
                                       damagingSkillIds: Array.from(damagingSkillIds),
                                       players: rotPlayers,
                             });
                     }
  });

  return { skillMeta, fights: fightRows, totalFights: fights.length };
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
function computeTopSkills(fights: FightInput[]): { topSkills: TopSkill[]; topIncomingSkills: TopSkill[]; topSkillsByDamage: TopSkill[]; topSkillsByDownContribution: TopSkill[] } {
    const naturalFortitude = computeNaturalFortitudeDamage(fights);
    const skillMeta = new Map<number, { name: string; icon?: string }>();
    const outgoing = new Map<number, { damage: number; hits: number; downContribution: number }>();
    const incoming = new Map<number, { damage: number; hits: number; downContribution: number }>();
    const outgoingFightValues = new Map<number, number[]>();
    const incomingFightValues = new Map<number, number[]>();
    const outgoingFightPeaks = new Map<number, { value: number; fightIndex: number; fightName: string; fightLabel: string }>();
    const incomingFightPeaks = new Map<number, { value: number; fightIndex: number; fightName: string; fightLabel: string }>();
    const outgoingPlayers = new Map<number, Set<string>>();
    const incomingPlayers = new Map<number, Set<string>>();
    const outgoingActiveMs = new Map<number, number>();
    const incomingActiveMs = new Map<number, number>();
    const outgoingBest = new Map<number, { value: number; account: string; profession: string; fightIndex: number; fightName: string; fightLabel: string }>();
    const incomingBest = new Map<number, { value: number; account: string; profession: string; fightIndex: number; fightName: string; fightLabel: string }>();

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

  function recordPlayer(target: Map<number, Set<string>>, id: number, account: string) {
        const players = target.get(id) ?? new Set<string>();
        players.add(account);
        target.set(id, players);
  }

  function playerActiveMs(p: Record<string, unknown>, raw: Record<string, unknown>): number {
        const activeTimes = p.activeTimes as unknown;
        const activeMs = Array.isArray(activeTimes) && typeof activeTimes[0] === 'number'
          ? activeTimes[0]
          : Number(raw.durationMS) || 0;
        return Math.max(0, activeMs);
  }

  function recordActiveMs(target: Map<number, number>, ids: Set<number>, activeMs: number) {
        if (activeMs <= 0) return;
        for (const id of ids) {
          target.set(id, (target.get(id) ?? 0) + activeMs);
        }
  }

  function fightContext(f: FightInput, fightIndex: number) {
        const fightName = f.summary.fightName || `Fight ${fightIndex + 1}`;
        return {
          fightIndex,
          fightName,
          fightLabel: `F${fightIndex + 1} · ${fightName}`,
        };
  }

  function recordFightValues(
        target: Map<number, number[]>,
        peaks: Map<number, { value: number; fightIndex: number; fightName: string; fightLabel: string }>,
        values: Map<number, number>,
        context: { fightIndex: number; fightName: string; fightLabel: string },
      ) {
        for (const [id, value] of values) {
          const samples = target.get(id) ?? [];
          samples.push(value);
          target.set(id, samples);
          const currentPeak = peaks.get(id);
          if (!currentPeak || value > currentPeak.value) {
                peaks.set(id, { ...context, value });
          }
        }
  }

    type DistEntry = { id?: number; totalDamage?: number; connectedHits?: number; hits?: number; downContribution?: number; max?: number };

  for (const [fightIndex, f] of fights.entries()) {
        const raw = f.raw as Record<string, unknown>;
        const context = fightContext(f, fightIndex);
        const fightOutgoing = new Map<number, number>();
        const fightIncoming = new Map<number, number>();
        const skillMap = (raw.skillMap ?? {}) as Record<string, { name?: string; icon?: string }>;
        for (const key of Object.keys(skillMap)) {
                const def = skillMap[key];
                const id = Number(key.replace(/^s/, ''));
                if (Number.isFinite(id) && def?.name && !skillMeta.has(id)) {
                          skillMeta.set(id, { name: def.name, icon: def.icon });
                }
        }
        // totalDamageDist/totalDamageTaken entries aren't limited to true "skill" casts -
      // condition damage ticks (bleeding, poison, burning, etc.) are attributed to the
      // condition's buff id, which only exists in buffMap, not skillMap. Without this
      // fallback those ticks show up unnamed as "Skill 736" (Bleeding), "Skill 723"
      // (Poison), and so on, with no icon.
      const buffMap = (raw.buffMap ?? {}) as Record<string, { name?: string; icon?: string }>;
        for (const key of Object.keys(buffMap)) {
                const def = buffMap[key];
                const id = Number(key.replace(/^b/, ''));
                if (Number.isFinite(id) && def?.name && !skillMeta.has(id)) {
                          skillMeta.set(id, { name: def.name, icon: def.icon });
                }
        }

      const players = (raw.players ?? []) as Record<string, unknown>[];
        for (const p of players) {
                if (p.notInSquad) continue;
                const account = String(p.account ?? p.name ?? 'Unknown');
                const activeMs = playerActiveMs(p, raw);
                const playerOutgoingSkillIds = new Set<number>();
                const playerIncomingSkillIds = new Set<number>();

          const outDist = (p.totalDamageDist ?? []) as DistEntry[][];
                for (const entry of outDist[0] ?? []) {
                          const id = Number(entry?.id);
                          if (!Number.isFinite(id)) continue;
                          const dmg = Number(entry?.totalDamage) || 0;
                          const hits = Number(entry?.connectedHits ?? entry?.hits) || 0;
                          const downContrib = Number(entry?.downContribution) || 0;
                          if (dmg === 0 && hits === 0 && downContrib === 0) continue;
                fightOutgoing.set(id, (fightOutgoing.get(id) ?? 0) + dmg);
                playerOutgoingSkillIds.add(id);
                recordPlayer(outgoingPlayers, id, account);
                const hitMax = Number(entry?.max) || 0;
                if (hitMax > 0) {
                    const prevBest = outgoingBest.get(id);
                    if (!prevBest || hitMax > prevBest.value) {
                        outgoingBest.set(id, {
                            value: hitMax,
                            account,
                            profession: String(p.profession ?? 'Unknown'),
                            ...context,
                        });
                    }
                }
                          accumulate(outgoing, id, dmg, hits, downContrib);
                }

          const inDist = ((p.totalDamageTakenDist ?? p.totalDamageTaken) ?? []) as DistEntry[][];
                for (const entry of inDist[0] ?? []) {
                          const id = Number(entry?.id);
                          if (!Number.isFinite(id)) continue;
                          const dmg = Number(entry?.totalDamage) || 0;
                          const hits = Number(entry?.connectedHits ?? entry?.hits) || 0;
                          // Mirrors the outgoing branch above: EI's totalDamageTaken entries use
                  // the same DistEntry shape as totalDamageDist and carry their own
                  // downContribution value (how much of this incoming skill's damage
                  // contributed to this player going down) - it was previously hardcoded
                  // to 0 here instead of being read, so "Incoming" always showed an empty
                  // Down Contrib bar regardless of the underlying data.
                  const downContrib = Number(entry?.downContribution) || 0;
                          if (dmg === 0 && hits === 0 && downContrib === 0) continue;
                fightIncoming.set(id, (fightIncoming.get(id) ?? 0) + dmg);
                playerIncomingSkillIds.add(id);
                recordPlayer(incomingPlayers, id, account);
                const hitMaxIn = Number(entry?.max) || 0;
                if (hitMaxIn > 0) {
                    const prevBestIn = incomingBest.get(id);
                    if (!prevBestIn || hitMaxIn > prevBestIn.value) {
                        incomingBest.set(id, {
                            value: hitMaxIn,
                            account,
                            profession: String(p.profession ?? 'Unknown'),
                            ...context,
                        });
                    }
                }
                          accumulate(incoming, id, dmg, hits, downContrib);
                }
                recordActiveMs(outgoingActiveMs, playerOutgoingSkillIds, activeMs);
                recordActiveMs(incomingActiveMs, playerIncomingSkillIds, activeMs);
        }
        recordFightValues(outgoingFightValues, outgoingFightPeaks, fightOutgoing, context);
        recordFightValues(incomingFightValues, incomingFightPeaks, fightIncoming, context);
  }

  if (naturalFortitude.damage > 0 || naturalFortitude.hits > 0) {
        skillMeta.set(NATURAL_FORTITUDE_SYNTHETIC_SKILL_ID, {
          name: NATURAL_FORTITUDE_TRAIT_NAME,
          icon: NATURAL_FORTITUDE_TRAIT_ICON,
        });
        accumulate(outgoing, NATURAL_FORTITUDE_SYNTHETIC_SKILL_ID, naturalFortitude.damage, naturalFortitude.hits, 0);
        outgoingFightValues.set(NATURAL_FORTITUDE_SYNTHETIC_SKILL_ID, naturalFortitude.fightDamage);
        outgoingPlayers.set(NATURAL_FORTITUDE_SYNTHETIC_SKILL_ID, new Set(naturalFortitude.byPlayerKey.keys()));
  }

    function toRows(
      map: Map<number, { damage: number; hits: number; downContribution: number }>,
      bestMap: Map<number, { value: number; account: string; profession: string; fightIndex: number; fightName: string; fightLabel: string }>,
      fightValues: Map<number, number[]>,
      fightPeaks: Map<number, { value: number; fightIndex: number; fightName: string; fightLabel: string }>,
      players: Map<number, Set<string>>,
      activeMs: Map<number, number>,
    ): TopSkill[] {
        return Array.from(map.entries())
          .map(([id, v]) => {
                const samples = fightValues.get(id) ?? [];
                const sampleTotal = samples.reduce((sum, value) => sum + value, 0);
                return {
                    name: skillMeta.get(id)?.name ?? `Skill ${id}`,
                    icon: skillMeta.get(id)?.icon,
                    id,
                    damage: v.damage,
                    hits: v.hits,
                    downContribution: v.downContribution,
                    biggestHit: bestMap.get(id) ?? null,
                    fightCount: samples.length,
                    playerCount: players.get(id)?.size ?? 0,
                    activeMs: activeMs.get(id),
                    perFightMin: samples.length > 0 ? Math.min(...samples) : 0,
                    perFightAverage: samples.length > 0 ? sampleTotal / samples.length : 0,
                    perFightMax: samples.length > 0 ? Math.max(...samples) : 0,
                    perFightMaxContext: fightPeaks.get(id) ?? null,
                };
          })
          .filter((s) => s.damage > 0 || s.hits > 0 || s.downContribution > 0);
  }

    const outgoingRows = toRows(outgoing, outgoingBest, outgoingFightValues, outgoingFightPeaks, outgoingPlayers, outgoingActiveMs);
    const incomingRows = toRows(incoming, incomingBest, incomingFightValues, incomingFightPeaks, incomingPlayers, incomingActiveMs);
  const byDamage = (rows: TopSkill[]) => [...rows].sort((a, b) => b.damage - a.damage || b.downContribution - a.downContribution).slice(0, 30);
  const byDownContribution = (rows: TopSkill[]) => [...rows].sort((a, b) => b.downContribution - a.downContribution || b.damage - a.damage).slice(0, 30);

  return {
        topSkills: byDamage(outgoingRows),
        topIncomingSkills: byDamage(incomingRows),
        topSkillsByDamage: byDamage(outgoingRows),
        topSkillsByDownContribution: byDownContribution(outgoingRows),
  };
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

// Top outgoing healing sources squad-wide, by skill or trait/buff, mirroring
// dps.report's healing distribution breakdown - this is what makes something
// like a necromancer's "Life Siphon" (a directly-cast dagger skill, API id
// 69302, that deals damage and heals its caster per pulse) or a revenant's
// "Replenishing Despair" (a Corruption trait, id 1741, whose triggered
// "trait skill" effect id 76497 siphons health from nearby enemies whenever
// the revenant gains dark aura - verified against the live GW2 wiki, not
// assumed) show up as a quantified line instead of disappearing into an
// undifferentiated total.
// Reads player.extHealingStats.totalHealingDist[phase 0] = [{ totalHealing,
// hits, id, indirectHealing }] straight from the raw log (confirmed against
// EI's EXTJsonPlayerHealingStats.TotalHealingDist / EXTJsonHealingDist JSON
// doc). indirectHealing tells us whether to *label* an entry "Trait" or
// "Skill" in the UI, but it does NOT reliably predict which map (skillMap
// vs buffMap) the id's actual name/icon live in - "trait skills" like
// Replenishing Despair behave like triggered skills in the combat log, so
// EI may file their metadata under either map depending on the ability.
// computeTopSkills() above already had to work around this exact same gap
// for condition-damage ticks (see its comment ~line 622); this reuses that
// same skillMap-then-buffMap merge instead of a strict either/or lookup, so
// an id resolves correctly regardless of which map actually holds it. This
// extension data is only present when the log was recorded with arcdps's
// healing addon active - the same precondition HealingPlayer.hasHealAddon
// already flags elsewhere in this file.
function computeTopHealingSkills(fights: FightInput[]): TopHealingSource[] {
    type HealDistEntry = { totalHealing?: number; hits?: number; id?: number; indirectHealing?: boolean; max?: number };

  const totals = new Map<string, { id: number; healing: number; hits: number; isTrait: boolean }>();
    const fightValues = new Map<string, number[]>();
    const fightPeaks = new Map<string, { value: number; fightIndex: number; fightName: string; fightLabel: string }>();
    const sourcePlayers = new Map<string, Set<string>>();
    const sourceActiveMs = new Map<string, number>();
    const bestHeal = new Map<string, { value: number; account: string; profession: string; fightIndex: number; fightName: string; fightLabel: string }>();
    // Merged skill+buff name/icon lookup, keyed by numeric id regardless of
  // which map it came from - same precedence (skillMap first, buffMap only
  // fills gaps) as computeTopSkills' skillMeta above.
  const nameMeta = new Map<number, { name: string; icon?: string }>();

  for (const [fightIndex, f] of fights.entries()) {
        const raw = f.raw as Record<string, unknown>;
        const fightName = f.summary.fightName || `Fight ${fightIndex + 1}`;
        const context = {
                fightIndex,
                fightName,
                fightLabel: `F${fightIndex + 1} · ${fightName}`,
        };
        const fightHealing = new Map<string, number>();
        const skillMap = (raw.skillMap ?? {}) as Record<string, { name?: string; icon?: string }>;
        const buffMap = (raw.buffMap ?? {}) as Record<string, { name?: string; icon?: string }>;
        for (const key of Object.keys(skillMap)) {
                const def = skillMap[key];
                const id = Number(key.replace(/^s/, ''));
                if (Number.isFinite(id) && def?.name && !nameMeta.has(id)) {
                          nameMeta.set(id, { name: def.name, icon: def.icon });
                }
        }
        for (const key of Object.keys(buffMap)) {
                const def = buffMap[key];
                const id = Number(key.replace(/^b/, ''));
                if (Number.isFinite(id) && def?.name && !nameMeta.has(id)) {
                          nameMeta.set(id, { name: def.name, icon: def.icon });
                }
        }

      const players = (raw.players ?? []) as Record<string, unknown>[];

      for (const p of players) {
              if (p.notInSquad) continue;
              const account = String(p.account ?? p.name ?? 'Unknown');
              const activeTimes = p.activeTimes as unknown;
              const activeMs = Math.max(0, Array.isArray(activeTimes) && typeof activeTimes[0] === 'number'
                ? activeTimes[0]
                : Number(raw.durationMS) || 0);
              const playerHealingKeys = new Set<string>();
              const ext = p.extHealingStats as Record<string, unknown> | undefined;
              const dist = (ext?.totalHealingDist as HealDistEntry[][] | undefined)?.[0];
              if (!Array.isArray(dist)) continue;

          for (const entry of dist) {
                    const id = Number(entry?.id);
                    if (!Number.isFinite(id)) continue;
                    const isTrait = !!entry?.indirectHealing;
                    const healing = Number(entry?.totalHealing) || 0;
                    const hits = Number(entry?.hits) || 0;
                    if (healing === 0 && hits === 0) continue;

                const key = `${isTrait ? 'b' : 's'}${id}`;
                    const cur = totals.get(key) || { id, healing: 0, hits: 0, isTrait };
                    cur.healing += healing;
                    cur.hits += hits;
                fightHealing.set(key, (fightHealing.get(key) ?? 0) + healing);
                const playersForSource = sourcePlayers.get(key) ?? new Set<string>();
                playersForSource.add(account);
                sourcePlayers.set(key, playersForSource);
                playerHealingKeys.add(key);
                const healMax = Number(entry?.max) || 0;
                if (healMax > 0) {
                    const prevBestHeal = bestHeal.get(key);
                    if (!prevBestHeal || healMax > prevBestHeal.value) {
                        bestHeal.set(key, {
                            value: healMax,
                            account,
                            profession: String(p.profession ?? 'Unknown'),
                            ...context,
                        });
                    }
                }
                    totals.set(key, cur);
          }
          if (activeMs > 0) {
                  for (const key of playerHealingKeys) {
                          sourceActiveMs.set(key, (sourceActiveMs.get(key) ?? 0) + activeMs);
                  }
          }
      }
      for (const [key, value] of fightHealing) {
              const samples = fightValues.get(key) ?? [];
              samples.push(value);
              fightValues.set(key, samples);
              const currentPeak = fightPeaks.get(key);
              if (!currentPeak || value > currentPeak.value) {
                      fightPeaks.set(key, { ...context, value });
              }
      }
  }

  return Array.from(totals.entries())
      .map(([, v]) => {
              const meta = nameMeta.get(v.id);
              const key = `${v.isTrait ? 'b' : 's'}${v.id}`;
              const samples = fightValues.get(key) ?? [];
              const sampleTotal = samples.reduce((sum, value) => sum + value, 0);
              return {
                        id: v.id,
                        name: meta?.name || `${v.isTrait ? 'Trait' : 'Skill'} ${v.id}`,
                        icon: meta?.icon,
                        healing: v.healing,
                        hits: v.hits,
                        isTrait: v.isTrait,
                biggestHit: bestHeal.get(key) ?? null,
                fightCount: samples.length,
                playerCount: sourcePlayers.get(key)?.size ?? 0,
                activeMs: sourceActiveMs.get(key),
                perFightMin: samples.length > 0 ? Math.min(...samples) : 0,
                perFightAverage: samples.length > 0 ? sampleTotal / samples.length : 0,
                perFightMax: samples.length > 0 ? Math.max(...samples) : 0,
                perFightMaxContext: fightPeaks.get(key) ?? null,
              };
      })
      .sort((a, b) => b.healing - a.healing)
      .slice(0, 25);
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

// Per-death damage breakdown (dps.report's "Death Recap" panel). Reads
// player.deathRecap = { deathTime, toDown: [...], toKill: [...] } straight
// from the raw log (confirmed against EI's JsonPlayer.DeathRecap /
// JsonDeathRecap / JsonDeathRecapDamageItem JSON doc - toDown covers hits
// from combat-entry to going down, toKill covers hits from down to the
// final blow; each item's id is a skill id unless indirectDamage is true,
// in which case it's a buff id, same s/b-prefixed lookup convention as
// elsewhere in this file). Only present for players who actually died -
// most players in most fights won't have one.
function computeDeathRecaps(fights: FightInput[]): DeathRecapEntry[] {
    type RawHit = { id?: number; indirectDamage?: boolean; src?: string; damage?: number; time?: number };
    type RawRecap = { deathTime?: number; toDown?: RawHit[]; toKill?: RawHit[] };

  const out: DeathRecapEntry[] = [];

  fights.forEach((f, fightIndex) => {
        const raw = f.raw as Record<string, unknown>;
        const skillMap = (raw.skillMap ?? {}) as Record<string, { name?: string; icon?: string }>;
        const buffMap = (raw.buffMap ?? {}) as Record<string, { name?: string; icon?: string }>;
        const players = (raw.players ?? []) as Record<string, unknown>[];
        const fightName = f.summary.fightName || `Fight ${fightIndex + 1}`;

                     function resolveHit(h: RawHit) {
                             const id = Number(h.id);
                             const isIndirect = !!h.indirectDamage;
                             const def = isIndirect ? buffMap[`b${id}`] : skillMap[`s${id}`];
                             return {
                                       id: Number.isFinite(id) ? id : 0,
                                       name: def?.name || `${isIndirect ? 'Buff' : 'Skill'} ${id}`,
                                       icon: def?.icon,
                                       isIndirect,
                                       src: h.src || 'Unknown',
                                       damage: Number(h.damage) || 0,
                                       time: Number(h.time) || 0,
                             };
                     }

                     for (const p of players) {
                             if (p.notInSquad) continue;
                             // EI's JsonPlayer.DeathRecap is a *list* (List<JsonDeathRecap>), not a
          // single object - a player can die and get revived more than once in
          // the same fight, and each death gets its own entry. Treating it as a
          // bare object (as this used to do) meant `.toDown`/`.toKill` were
          // always undefined, so every death was silently skipped and this tab
          // was empty for every report. Iterate the array so multi-death fights
          // surface one card per death, not just the first/last.
          const recaps = (p.deathRecap ?? []) as RawRecap[];
                             if (!Array.isArray(recaps)) continue;

          for (const recap of recaps) {
                    if (!recap || (!recap.toDown?.length && !recap.toKill?.length)) continue;

                               out.push({
                                           account: typeof p.account === 'string' ? p.account : 'Unknown',
                                           profession: typeof p.profession === 'string' ? p.profession : 'Unknown',
                                           characterName: typeof p.name === 'string' ? p.name : 'Unknown',
                                           fightName,
                                           fightIndex,
                                           deathTimeMs: Number(recap.deathTime) || 0,
                                           toDown: (recap.toDown ?? []).map(resolveHit).sort((a, b) => a.time - b.time),
                                           toKill: (recap.toKill ?? []).map(resolveHit).sort((a, b) => a.time - b.time),
                               });
          }
                     }
  });

  // Most recent deaths first within a report is less useful than grouping by
  // fight, then chronologically within the fight - matches how someone would
  // actually review "what killed us" fight by fight.
  out.sort((a, b) => a.fightIndex - b.fightIndex || a.deathTimeMs - b.deathTimeMs);
    return out;
}

// Auto-generated "standout moment" cards, one per fight-night, scored from
// per-fight combat data that's otherwise only visible if you dig through
// Fight Breakdown / Death Recap manually. Reads straight from each raw EI
// log rather than the (currently-unpopulated-for-raw-logs) fightBreakdown
// table, following the same per-fight-iteration pattern as
// computeDeathRecaps/computeRotations above.
//
// Field provenance (confirmed against EI's JsonPlayer / JsonGameplayStatsAll
// / JsonDefensesAll doxygen docs):
// - player.statsAll[phase].killed / .downed - enemies killed/downed by this player.
// - player.statsAll[phase].downContribution - EI's absolute damage contribution
//   against downed enemies, used for MVP Moment.
// - player.defenses[phase].downCount / .deadCount - how many times this
//   player themselves went down/died.
function enemyPlayerCount(raw: Record<string, unknown>): number {
    const targets = Array.isArray(raw.targets) ? raw.targets as Array<{ isFake?: boolean }> : [];
    return targets.filter((target) => !target.isFake).length;
}

function computeFightHighlights(fights: FightInput[]): FightHighlight[] {
    type RawPlayer = {
          account?: string;
          profession?: string;
          notInSquad?: boolean;
          defenses?: Array<{ downCount?: number; deadCount?: number }>;
          statsAll?: Array<{ killed?: number; downed?: number; downContribution?: number }>;
    };

  const perFight = fights.map((f, i) => {
        const raw = f.raw as Record<string, unknown>;
        const players = (raw.players ?? []) as RawPlayer[];
        const squad = players.filter((p) => !p.notInSquad);

        let topDownContrib = { account: '', profession: '', value: 0 };

                                  for (const p of squad) {
                                          const stats = p.statsAll?.[0];
                                          const dc = Number(stats?.downContribution) || 0;
                                          if (dc > topDownContrib.value) {
                                                    topDownContrib = { account: p.account || 'Unknown', profession: p.profession || 'Unknown', value: dc };
                                          }
                                  }

                                  const durationMs = Number(raw.durationMS) || 0;
        const success = getFightOutcome(raw);
        const squadCount = squad.length;
        const enemyCount = enemyPlayerCount(raw);
        const downsDeaths = getFightDownsDeaths(raw);
        const alliesDown = Math.max(0, downsDeaths.squadDownsDeaths - downsDeaths.squadDeaths);
        const alliesDead = downsDeaths.squadDeaths;
        const enemyKills = downsDeaths.enemyDeaths;
        const enemyDowns = Math.max(0, downsDeaths.enemyDownsDeaths - downsDeaths.enemyDeaths);
        const fightName = f.summary.fightName || `Fight ${i + 1}`;
        const timestamp = Date.parse((raw.timeStartStd as string) ?? '') || 0;
        const kdr = alliesDead > 0 ? enemyKills / alliesDead : enemyKills > 0 ? Infinity : 0;

                                  return { i, fightName, timestamp, durationMs, success, squadCount, enemyCount, alliesDown, alliesDead, enemyKills, enemyDowns, kdr, topDownContrib };
  }).filter((f) => f.squadCount > 0);

  if (perFight.length === 0) return [];

  const highlights: FightHighlight[] = [];
    const wins = perFight.filter((f) => f.success === true && f.enemyKills > 0);
    const losses = perFight.filter((f) => f.success === false);

  if (wins.length > 0) {
        const best = wins.reduce((a, b) => (b.kdr > a.kdr ? b : a));
        highlights.push({
                id: 'blowout',
                title: 'Biggest Blowout',
                description: `${best.enemyKills} enemy kills for just ${best.alliesDead} losses in ${best.fightName} - a ${Number.isFinite(best.kdr) ? best.kdr.toFixed(1) : '∞'}:1 trade.`,
                fightName: best.fightName,
                fightIndex: best.i,
                timestamp: best.timestamp,
        });
  }

  const toughLosses = losses.filter((f) => f.alliesDead > 0);
    if (toughLosses.length > 0) {
          const worst = toughLosses.reduce((a, b) => (b.alliesDead > a.alliesDead ? b : a));
          highlights.push({
                  id: 'toughest',
                  title: 'Toughest Fight',
                  description: `Lost ${worst.alliesDead} of ${worst.squadCount} squad members in ${worst.fightName} against ${worst.enemyCount} enemies.`,
                  fightName: worst.fightName,
                  fightIndex: worst.i,
                  timestamp: worst.timestamp,
          });
    }

  const longest = perFight.reduce((a, b) => (b.durationMs > a.durationMs ? b : a));
    if (longest.durationMs > 0) {
          const mins = Math.floor(longest.durationMs / 60000);
          const secs = Math.round((longest.durationMs % 60000) / 1000);
          highlights.push({
                  id: 'longest',
                  title: 'Longest Engagement',
                  description: `${longest.fightName} ran ${mins}m ${secs}s - the longest fight of the night.`,
                  fightName: longest.fightName,
                  fightIndex: longest.i,
                  timestamp: longest.timestamp,
          });
    }

  const outnumberedWins = wins.filter((f) => f.enemyCount > f.squadCount);
    if (outnumberedWins.length > 0) {
          const best = outnumberedWins.reduce((a, b) => (b.enemyCount / b.squadCount > a.enemyCount / a.squadCount ? b : a));
          highlights.push({
                  id: 'outnumbered',
                  title: 'Outnumbered and Won',
                  description: `${best.squadCount} squad members took down ${best.enemyCount} enemies in ${best.fightName}.`,
                  fightName: best.fightName,
                  fightIndex: best.i,
                  timestamp: best.timestamp,
          });
    }

  const flawless = wins.filter((f) => f.alliesDown === 0);
    if (flawless.length > 0) {
          const best = flawless.reduce((a, b) => (b.enemyKills > a.enemyKills ? b : a));
          highlights.push({
                  id: 'flawless',
                  title: 'Flawless Victory',
                  description: `${best.enemyKills} enemy kills in ${best.fightName} without a single squad member going down.`,
                  fightName: best.fightName,
                  fightIndex: best.i,
                  timestamp: best.timestamp,
          });
    }

  const mvpCandidates = perFight.filter((f) => f.topDownContrib.value > 0);
    if (mvpCandidates.length > 0) {
          const best = mvpCandidates.reduce((a, b) => (b.topDownContrib.value > a.topDownContrib.value ? b : a));
                  highlights.push({
                  id: 'mvp-moment',
                  title: 'MVP Moment',
                  description: `${best.topDownContrib.account} recorded ${Math.round(best.topDownContrib.value).toLocaleString('en-US')} down contribution in ${best.fightName}.`,
                  fightName: best.fightName,
                  fightIndex: best.i,
                  timestamp: best.timestamp,
                  account: best.topDownContrib.account,
                  profession: best.topDownContrib.profession,
                  value: best.topDownContrib.value,
                  valueFormat: 'number',
                  valueLabel: 'down contribution',
          });
    }

  highlights.sort((a, b) => a.timestamp - b.timestamp);
    return highlights;
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

  function avgBoonValue(boonName: string): { value: number; stacking: boolean; lowest?: { account: string; value: number } } | null {
        if (!boons) return null;
        const col = boons.columns.find((c) => c.name === boonName);
        if (!col) return null;
        const withData = boons.rows.filter((r) => r.uptimes[col.id] !== undefined);
        if (withData.length === 0) return null;
        const lowestRow = withData.reduce((lowest, row) => (row.uptimes[col.id] < lowest.uptimes[col.id] ? row : lowest));
        return {
          value: withData.reduce((sum, r) => sum + (r.uptimes[col.id] || 0), 0) / withData.length,
          stacking: !!col.stacking,
          lowest: { account: lowestRow.account, value: lowestRow.uptimes[col.id] },
        };
  }

  const quickness = avgBoonValue('Quickness')?.value ?? null;
    if (quickness !== null) {
          if (quickness < 20) {
                  insights.push({ id: 'quickness', severity: 'critical', title: 'Very low Quickness uptime', detail: `Squad averaged only ${quickness.toFixed(0)}% Quickness uptime - DPS is likely being left on the table without a dedicated quickness support.` });
          } else if (quickness < 50) {
                  insights.push({ id: 'quickness', severity: 'warn', title: 'Low Quickness uptime', detail: `Squad averaged ${quickness.toFixed(0)}% Quickness uptime, below the ~70%+ a coordinated squad usually holds.` });
          } else {
                  insights.push({ id: 'quickness', severity: 'good', title: 'Solid Quickness uptime', detail: `Squad averaged ${quickness.toFixed(0)}% Quickness uptime.` });
          }
    }

  // Alacrity has no reliable WvW source (no PvE-style Alacrity support builds
  // in squad comps), so a "low Alacrity uptime" insight is just noise here -
  // skip it. Quickness/Stability are the boons worth flagging in WvW.

  const stability = avgBoonValue('Stability');
    if (stability !== null) {
          if (stability.stacking) {
                if (stability.value < 0.15) {
                        insights.push({ id: 'stability', severity: 'critical', title: 'Very low Stability coverage', detail: `Squad averaged only ${stability.value.toFixed(2)} Stability stacks - vulnerable to CC chains and pulls/knockbacks.` });
                } else if (stability.value < 0.35) {
                        insights.push({ id: 'stability', severity: 'warn', title: 'Low Stability coverage', detail: `Squad averaged ${stability.value.toFixed(2)} Stability stacks. Stability is an intensity-stacking boon, so Entropy shows EI-style average stacks here instead of a percent.` });
                } else if (stability.lowest && stability.lowest.value < 0.15) {
                        insights.push({ id: 'stability', severity: 'warn', title: 'Stability gap detected', detail: `${stability.lowest.account} averaged only ${stability.lowest.value.toFixed(2)} Stability stacks. Stability is an intensity-stacking boon, so Entropy shows EI-style average stacks here instead of a percent.` });
                }
          } else if (stability.value < 15) {
                  insights.push({ id: 'stability', severity: 'critical', title: 'Very low Stability uptime', detail: `Squad averaged only ${stability.value.toFixed(0)}% Stability uptime - vulnerable to CC chains and pulls/knockbacks.` });
          } else if (stability.value < 30) {
                  insights.push({ id: 'stability', severity: 'warn', title: 'Low Stability uptime', detail: `Squad averaged ${stability.value.toFixed(0)}% Stability uptime.` });
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

// Per-fight table, map distribution and session timeline. All three were
// left as empty stubs when this file was first ported, which meant the
// Fight Breakdown, Map Distribution and timeline views rendered blank for
// every raw-log report ever built - not a bug in those views, they simply
// had nothing to draw. Everything here comes from data already on each raw
// EI log, using the same per-fight iteration as computeFightHighlights.
// Per-commander record across the session. EI flags the tag holder with
// player.hasCommanderTag, so a "commander fight" is simply one where that
// account carried the tag - aggregated per account because a session often
// has more than one tag, and people swap classes between pulls.
function computeCommanderStats(fights: FightInput[]): CommanderRow[] {
    type RawP = {
          account?: string; name?: string; profession?: string; notInSquad?: boolean;
          hasCommanderTag?: boolean;
          defenses?: Array<{ downCount?: number; deadCount?: number; damageTaken?: number; damageBarrier?: number }>;
          statsAll?: Array<{ killed?: number; downed?: number }>;
    };

  interface Acc {
        account: string; names: Set<string>; professions: Set<string>;
        fights: number; wins: number; losses: number; unclassified: number; durationMs: number;
        squadSizeAccum: number; enemyAccum: number;
        kills: number; downs: number; squadKills: number; squadDowns: number; cmdDowns: number; cmdDeaths: number;
        alliesDown: number; alliesDead: number; damageTaken: number; barrier: number;
        fightIndices: number[];
  }
    const byAccount = new Map<string, Acc>();

  for (const [fightIndex, f] of fights.entries()) {
        const raw = f.raw as Record<string, unknown>;
        const players = (raw.players ?? []) as RawP[];
        const squad = players.filter((p) => !p.notInSquad);
        const enemyCount = enemyPlayerCount(raw);
        const durationMs = Number(raw.durationMS) || 0;
        const isWin = getFightOutcome(raw);
        const downsDeaths = getFightDownsDeaths(raw);
        const alliesDown = Math.max(0, downsDeaths.squadDownsDeaths - downsDeaths.squadDeaths);
        const alliesDead = downsDeaths.squadDeaths;
        const squadKills = downsDeaths.enemyDeaths;
        const squadDowns = Math.max(0, downsDeaths.enemyDownsDeaths - downsDeaths.enemyDeaths);

      for (const p of squad) {
              if (!p.hasCommanderTag) continue;
              const account = typeof p.account === "string" ? p.account : null;
              if (!account) continue;
              let a = byAccount.get(account);
              if (!a) {
                        a = {
                                    account, names: new Set(), professions: new Set(),
                                    fights: 0, wins: 0, losses: 0, unclassified: 0, durationMs: 0, squadSizeAccum: 0, enemyAccum: 0,
                                    kills: 0, downs: 0, squadKills: 0, squadDowns: 0, cmdDowns: 0, cmdDeaths: 0,
                                    alliesDown: 0, alliesDead: 0, damageTaken: 0, barrier: 0,
                                    fightIndices: [],
                        };
                        byAccount.set(account, a);
              }
              if (p.name) a.names.add(p.name);
              if (p.profession) a.professions.add(p.profession);
              a.fights += 1;
              if (isWin === true) a.wins += 1;
              else if (isWin === false) a.losses += 1;
              else a.unclassified += 1;
              a.durationMs += durationMs;
              a.squadSizeAccum += squad.length;
              a.enemyAccum += enemyCount;
              a.kills += Number(p.statsAll?.[0]?.killed) || 0;
              a.downs += Number(p.statsAll?.[0]?.downed) || 0;
              a.squadKills += squadKills;
              a.squadDowns += squadDowns;
              a.cmdDowns += Number(p.defenses?.[0]?.downCount) || 0;
              a.cmdDeaths += Number(p.defenses?.[0]?.deadCount) || 0;
              a.damageTaken += Number(p.defenses?.[0]?.damageTaken) || 0;
              a.barrier += Number(p.defenses?.[0]?.damageBarrier) || 0;
              a.alliesDown += alliesDown;
              a.alliesDead += alliesDead;
              a.fightIndices.push(fightIndex);
      }
  }

  return Array.from(byAccount.values())
      .map((a) => {
              const mins = a.durationMs / 60000;
              return {
                        key: a.account,
                        account: a.account,
                        characterNames: Array.from(a.names),
                        profession: Array.from(a.professions)[0] ?? "Unknown",
                        professionList: Array.from(a.professions),
                        fights: a.fights,
                        wins: a.wins,
                        losses: a.losses,
                        unclassified: a.unclassified,
                        winRatePct: a.wins + a.losses > 0 ? (a.wins / (a.wins + a.losses)) * 100 : 0,
                        totalDurationMs: a.durationMs,
                        avgSquadSize: a.fights > 0 ? Math.round(a.squadSizeAccum / a.fights) : 0,
                        avgEnemySize: a.fights > 0 ? Math.round(a.enemyAccum / a.fights) : 0,
                        kills: a.kills,
                        downs: a.downs,
                        squadKills: a.squadKills,
                        squadDowns: a.squadDowns,
                        commanderDowns: a.cmdDowns,
                        commanderDeaths: a.cmdDeaths,
                        alliesDown: a.alliesDown,
                        alliesDead: a.alliesDead,
                        kdr: a.cmdDeaths > 0 ? a.kills / a.cmdDeaths : a.kills,
                        damageTaken: a.damageTaken,
                        damageTakenPerMinute: mins > 0 ? a.damageTaken / mins : 0,
                        incomingBarrierAbsorbed: a.barrier,
                        incomingBarrierAbsorbedPerMinute: mins > 0 ? a.barrier / mins : 0,
                        fightIndices: a.fightIndices,
              };
      })
      .sort((x, y) => y.fights - x.fights || y.winRatePct - x.winRatePct);
}

function computeFightTables(fights: FightInput[]): {
    fightBreakdown: FightRow[];
    mapData: ClassSlice[];
    timelineData: TimelinePoint[];
} {
    type RawP = {
          account?: string; profession?: string; notInSquad?: boolean; friendlyNPC?: boolean;
          defenses?: Array<{ downCount?: number; deadCount?: number; damageTaken?: number; damageBarrier?: number }>;
          statsAll?: Array<{ killed?: number; downed?: number; totalDamage?: number; boonStrips?: number }>;
          support?: Array<{ boonStrips?: number; condiCleanse?: number }>;
          totalDamageDist?: Array<Array<{ id?: number; totalDamage?: number; connectedHits?: number; hits?: number; downContribution?: number }>>;
          totalDamageTaken?: Array<{ damageTaken?: number } | number> | Array<Array<{ id?: number; totalDamage?: number; connectedHits?: number; hits?: number }>>;
          totalDamageTakenDist?: Array<Array<{ id?: number; totalDamage?: number; connectedHits?: number; hits?: number }>>;
          extHealingStats?: {
                  outgoingHealing?: Array<{ healing?: number }>;
                  outgoingHealingAllies?: Array<Array<{ healing?: number }>>;
                  totalHealingDist?: Array<Array<{ id?: number; totalHealing?: number; healing?: number; hits?: number }>>;
          };
          extBarrierStats?: {
                  outgoingBarrier?: Array<{ barrier?: number }>;
                  outgoingBarrierAllies?: Array<Array<{ barrier?: number }>>;
                  totalBarrierDist?: Array<Array<{ id?: number; totalBarrier?: number; barrier?: number; hits?: number }>>;
          };
    };

  const fightBreakdown: FightRow[] = [];
    const timelineData: TimelinePoint[] = [];
    const mapCounts = new Map<string, number>();

  fights.forEach((f, i) => {
        const raw = f.raw as Record<string, unknown>;
        const players = (raw.players ?? []) as RawP[];
        const squad = players.filter((p) => !p.notInSquad && !p.friendlyNPC);
        const allies = players.filter((p) => !p.notInSquad || p.friendlyNPC);
        const enemyCount = enemyPlayerCount(raw);

        const downsDeaths = getFightDownsDeaths(raw);
        const alliesDown = Math.max(0, downsDeaths.squadDownsDeaths - downsDeaths.squadDeaths);
        const alliesDead = downsDeaths.squadDeaths;
        const enemyKills = downsDeaths.enemyDeaths;
        const enemyDowns = Math.max(0, downsDeaths.enemyDownsDeaths - downsDeaths.enemyDeaths);
        let outDamage = 0, inDamage = 0, outHealing = 0, outBarrier = 0, outStrips = 0, inBarrier = 0;
        const squadClassCountsFight: Record<string, number> = {};
        const sumPhaseArray = (rows: any[] | undefined, field: string) =>
                Array.isArray(rows) ? rows.reduce((sum, row) => sum + (Number(row?.[field]) || 0), 0) : 0;
        const sumAllyPhaseMatrix = (rows: any[][] | undefined, field: string) =>
                Array.isArray(rows) ? rows.reduce((sum, phases) => sum + sumPhaseArray(phases, field), 0) : 0;

                     for (const p of squad) {
                             const def = p.defenses?.[0];
                             inDamage += Number(def?.damageTaken) || 0;
                             inBarrier += Number(def?.damageBarrier) || 0;
                             outDamage += (p.totalDamageDist?.[0] ?? []).reduce((sum, entry) => sum + (Number(entry?.totalDamage) || 0), 0);
                             outStrips += Number(p.support?.[0]?.boonStrips) || 0;
                             // Prefer the direct phase total when EI provides it. Fall back to the
                             // ally matrix, which is how older EI/healing-addon payloads expose the
                             // same outgoing healing/barrier split.
                             outHealing +=
                                     sumPhaseArray(p.extHealingStats?.outgoingHealing, 'healing') ||
                                     sumAllyPhaseMatrix(p.extHealingStats?.outgoingHealingAllies, 'healing');
                             outBarrier +=
                                     sumPhaseArray(p.extBarrierStats?.outgoingBarrier, 'barrier') ||
                                     sumAllyPhaseMatrix(p.extBarrierStats?.outgoingBarrierAllies, 'barrier');
                             const prof = String(p.profession || "Unknown");
                             squadClassCountsFight[prof] = (squadClassCountsFight[prof] || 0) + 1;
                     }

                     const durationMs = Number(raw.durationMS) || 0;
        const mins = Math.floor(durationMs / 60000);
        const secs = Math.round((durationMs % 60000) / 1000);
        const mapName = String(raw.fightName || raw.name || "Unknown Map");
        const timestamp = Date.parse((raw.timeStartStd as string) ?? "") || 0;
        const isWin = getFightOutcome(raw);
        const skillMap = (raw.skillMap ?? {}) as Record<string, { name?: string; icon?: string }>;
        const buffMap = (raw.buffMap ?? {}) as Record<string, { name?: string; icon?: string }>;
        const resolveMeta = (id: number) => {
                const def = skillMap[`s${id}`] ?? buffMap[`b${id}`];
                return {
                        name: String(def?.name || `Skill ${id}`),
                        icon: def?.icon,
                };
        };
        const outgoingSkillTotals = new Map<number, { damage: number; hits: number; downContribution: number }>();
        const incomingSkillTotals = new Map<number, { damage: number; hits: number; downContribution: number }>();
        const healingSkillTotals = new Map<number, { value: number; hits: number }>();
        const barrierSkillTotals = new Map<number, { value: number; hits: number }>();
        const pushOutgoing = (entry: any) => {
                const id = Number(entry?.id);
                if (!Number.isFinite(id)) return;
                const current = outgoingSkillTotals.get(id) ?? { damage: 0, hits: 0, downContribution: 0 };
                current.damage += Number(entry?.totalDamage ?? 0);
                current.hits += Number(entry?.connectedHits ?? entry?.hits ?? 0);
                current.downContribution += Number(entry?.downContribution ?? 0);
                outgoingSkillTotals.set(id, current);
        };
        const pushIncoming = (entry: any) => {
                const id = Number(entry?.id);
                if (!Number.isFinite(id)) return;
                const current = incomingSkillTotals.get(id) ?? { damage: 0, hits: 0, downContribution: 0 };
                current.damage += Number(entry?.totalDamage ?? 0);
                current.hits += Number(entry?.connectedHits ?? entry?.hits ?? 0);
                current.downContribution += Number(entry?.downContribution ?? 0);
                incomingSkillTotals.set(id, current);
        };
        const pushSupportSource = (
                totals: Map<number, { value: number; hits: number }>,
                entry: any,
                valueField: string,
        ) => {
                const id = Number(entry?.id);
                if (!Number.isFinite(id)) return;
                const current = totals.get(id) ?? { value: 0, hits: 0 };
                current.value += Number(entry?.[valueField] ?? 0);
                current.hits += Number(entry?.hits ?? 0);
                totals.set(id, current);
        };
        for (const p of squad) {
                p.totalDamageDist?.[0]?.forEach(pushOutgoing);
                (p.totalDamageTakenDist?.[0] ?? (Array.isArray(p.totalDamageTaken?.[0]) ? p.totalDamageTaken[0] : undefined))?.forEach(pushIncoming);
                p.extHealingStats?.totalHealingDist?.[0]?.forEach((entry) => pushSupportSource(healingSkillTotals, entry, 'totalHealing'));
                p.extBarrierStats?.totalBarrierDist?.[0]?.forEach((entry) => pushSupportSource(barrierSkillTotals, entry, 'totalBarrier'));
        }
        const topOutgoingDamageSkills: TopSkill[] = Array.from(outgoingSkillTotals.entries())
                .map(([id, total]) => {
                        const meta = resolveMeta(id);
                        return { id, name: meta.name, icon: meta.icon, damage: total.damage, hits: total.hits, downContribution: total.downContribution };
                })
                .filter((entry) => entry.damage > 0 || entry.downContribution > 0)
                .sort((a, b) => b.downContribution - a.downContribution || b.damage - a.damage)
                .slice(0, 50);
        const topIncomingDamageSkills: TopSkill[] = Array.from(incomingSkillTotals.entries())
                .map(([id, total]) => {
                        const meta = resolveMeta(id);
                        return { id, name: meta.name, icon: meta.icon, damage: total.damage, hits: total.hits, downContribution: total.downContribution };
                })
                .filter((entry) => entry.damage > 0)
                .sort((a, b) => b.damage - a.damage)
                .slice(0, 50);
        const topOutgoingHealingSkills: TopHealingSource[] = Array.from(healingSkillTotals.entries())
                .map(([id, total]) => {
                        const meta = resolveMeta(id);
                        return { id, name: meta.name, icon: meta.icon, healing: total.value, hits: total.hits, isTrait: false };
                })
                .filter((entry) => entry.healing > 0)
                .sort((a, b) => b.healing - a.healing)
                .slice(0, 50);
        const topOutgoingBarrierSkills: TopBarrierSource[] = Array.from(barrierSkillTotals.entries())
                .map(([id, total]) => {
                        const meta = resolveMeta(id);
                        return { id, name: meta.name, icon: meta.icon, barrier: total.value, hits: total.hits };
                })
                .filter((entry) => entry.barrier > 0)
                .sort((a, b) => b.barrier - a.barrier)
                .slice(0, 50);

                     mapCounts.set(mapName, (mapCounts.get(mapName) || 0) + 1);

                     fightBreakdown.push({
                             id: f.summary.permalink || `${mapName}-${i}`,
                             label: `#${i + 1}`,
                             fullLabel: f.summary.fightName || mapName,
                             permalink: f.summary.permalink,
                             timestamp,
                             mapName,
                             duration: `${mins}m ${secs}s`,
                             isWin,
                             squadCount: squad.length,
                             allyCount: allies.length,
                             enemyCount,
                             teamBreakdown: [],
                             alliesDown,
                             alliesDead,
                             alliesRevived: 0,
                             rallies: 0,
                             enemyDeaths: enemyKills,
                             enemyDowns,
                             totalOutgoingDamage: outDamage,
                             totalIncomingDamage: inDamage,
                             totalOutgoingHealing: outHealing,
                             totalOutgoingBarrier: outBarrier,
                             effectiveHealing: outHealing + outBarrier - inDamage,
                             topOutgoingHealingSkills,
                             topOutgoingBarrierSkills,
                             topOutgoingDamageSkills,
                             topIncomingDamageSkills,
                             totalOutgoingStrips: outStrips,
                             totalIncomingStrips: 0,
                             totalBoonsApplied: 0,
                             incomingBarrierAbsorbed: inBarrier,
                             outgoingBarrierAbsorbed: 0,
                             squadClassCountsFight,
                     });

                     timelineData.push({
                             timestamp,
                             squadCount: squad.length,
                             friendlyCount: allies.length,
                             enemies: enemyCount,
                             isWin,
                             index: i,
                             label: `#${i + 1}`,
                     });
  });

  const palette = ["#f59e0b", "#38bdf8", "#f43f5e", "#34d399", "#a78bfa", "#fb923c", "#22d3ee", "#e879f9"];
    const mapData: ClassSlice[] = Array.from(mapCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, color: palette[i % palette.length] }));

  return { fightBreakdown, mapData, timelineData };
}
interface PersistedIntelligence {
    combatEvents: CombatEvent[];
    criticalEvents: CriticalEvent[];
    engagementSegments: EngagementSegment[];
    intelligenceFindings: IntelligenceFinding[];
}

function computePersistedIntelligence(fights: FightInput[]): PersistedIntelligence {
    const combatEvents: CombatEvent[] = [];
    const criticalEvents: CriticalEvent[] = [];
    const engagementSegments: EngagementSegment[] = [];
    const intelligenceFindings: IntelligenceFinding[] = [];

    fights.forEach((fight, index) => {
        const fightId = fight.summary.permalink || `${fight.summary.fightName || 'fight'}-${index}`;
        const parsedReport = { details: fight.raw } as any;

        const downDeathSet = normalizeDeathEvents(parsedReport);
        combatEvents.push(...downDeathSet.events);

        const fightCriticalEvents: CriticalEvent[] = [
            ...detectMassDowns(downDeathSet, fightId),
            ...detectFailedRecoveries(downDeathSet, fightId),
            ...detectSquadSeparations(parsedReport, fightId, downDeathSet),
        ].sort((a, b) => a.timestampMs - b.timestampMs);

        criticalEvents.push(...fightCriticalEvents);

        const fightSegments = segmentEngagements({
            fightId,
            combatEvents: downDeathSet.events,
            criticalEvents: fightCriticalEvents,
        });

        engagementSegments.push(...fightSegments);

        intelligenceFindings.push(
            ...synthesizeFindings({
                fightId,
                segments: fightSegments,
                criticalEvents: fightCriticalEvents,
            }),
        );
    });

    return {
        combatEvents,
        criticalEvents,
        engagementSegments,
        intelligenceFindings,
    };
}

export function buildReportFromFights(fights: FightInput[]): WvWReport {
    if (fights.length === 0) throw new Error('No fights to combine.');

  const validLogs = fights.map((f) => ({ details: f.raw }));
  const distanceToTag = computeDistanceToTag(fights as Array<{ raw: Record<string, unknown>; summary?: { permalink?: string } }>);

  const agg = computePlayerAggregation({
        validLogs,
        method: 'count',
        skillDamageSource: 'target',
        // Combined performance tables represent people. Keep one stable row per
        // account even when that person swaps character, profession, role, or
        // subgroup between fights; professionList preserves the build history
        // and the longest-played profession remains the display profession.
        splitPlayersByClass: false,
  });

  const {
        playerStats,
        wins, losses, unclassified,
        totalSquadSizeAccum, totalEnemiesAccum,
        totalSquadDeaths, totalSquadKills, totalEnemyDeaths, totalEnemyKills,
        totalSquadDowns, totalEnemyDowns,
        enemyProfessionCounts,
  } = agg;

  const { fightBreakdown, mapData, timelineData } = computeFightTables(fights);
    const commanderRows = computeCommanderStats(fights);
    const total = fights.length;
    const avgSquadSize = total > 0 ? Math.round(totalSquadSizeAccum / total) : 0;
    const avgEnemies = total > 0 ? Math.round(totalEnemiesAccum / total) : 0;
  const canonicalTotals = fightBreakdown.reduce(
        (sum, fight) => {
                sum.squadKills += Number(fight.enemyDeaths || 0);
                sum.squadDeaths += Number(fight.alliesDead || 0);
                sum.squadDowns += Number(fight.enemyDowns || 0);
                sum.enemyDowns += Number(fight.alliesDown || 0);
                return sum;
        },
        { squadKills: 0, squadDeaths: 0, squadDowns: 0, enemyDowns: 0 },
  );
  const reportTotalSquadKills = canonicalTotals.squadKills || totalSquadKills;
  const reportTotalSquadDeaths = canonicalTotals.squadDeaths || totalSquadDeaths;
  const reportTotalSquadDowns = canonicalTotals.squadDowns || totalSquadDowns;
  const reportTotalEnemyDowns = canonicalTotals.enemyDowns || totalEnemyDowns;
  const reportTotalEnemyKills = reportTotalSquadDeaths || totalEnemyKills;
  const reportTotalEnemyDeaths = reportTotalSquadKills || totalEnemyDeaths;
    // Real numbers, not pre-formatted strings - ReportStats declares these as
  // `number` (consumers like generateFightRecap.ts do actual arithmetic on
  // them: `s.squadKDR / s.enemyKDR`). Formatting to 2 decimals / "∞" is a
  // display concern, handled by fmtFixed at render time.
  const squadKDR = reportTotalSquadDeaths > 0 ? reportTotalSquadKills / reportTotalSquadDeaths : reportTotalSquadKills > 0 ? Infinity : 0;
    const enemyKDR = reportTotalEnemyDeaths > 0 ? reportTotalEnemyKills / reportTotalEnemyDeaths : reportTotalEnemyKills > 0 ? Infinity : 0;

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

  const naturalFortitudePlayerDamage = computeNaturalFortitudeDamage(fights);
    if (naturalFortitudePlayerDamage.damage > 0) {
          for (const stat of playerEntries) {
                  const adjustment = naturalFortitudePlayerDamage.byPlayerKey.get(stat.account);
                  if (!adjustment) continue;
                  addNaturalFortitudeDamageToPlayer(stat, adjustment.damage, adjustment.hits);
          }
  }

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
              const primaryGroup = Object.entries(entry.groupTimeMs || {})
                .map(([group, timeMs]) => ({ group: Number(group), timeMs: Number(timeMs || 0) }))
                .filter((row) => Number.isFinite(row.group) && row.group > 0 && row.timeMs > 0)
                .sort((a, b) => b.timeMs - a.timeMs || a.group - b.group)[0]?.group;
              return {
                        account: entry.account || 'Unknown',
                        characterNames: Array.from(entry.characterNames || []).filter(Boolean).sort((a, b) => a.localeCompare(b)),
                        classTimes,
                        group: primaryGroup,
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

  const persistedIntelligence = computePersistedIntelligence(fights);

  const stats: ReportStats = {
        total, wins, losses, unclassified, avgSquadSize, avgEnemies, squadKDR, enemyKDR,
        totalSquadKills: reportTotalSquadKills,
        totalSquadDeaths: reportTotalSquadDeaths,
        totalEnemyKills: reportTotalEnemyKills,
        totalEnemyDeaths: reportTotalEnemyDeaths,
        totalSquadDowns: reportTotalSquadDowns,
        totalEnemyDowns: reportTotalEnemyDowns,
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
        mapData,
        timelineData,
        offensePlayers: playerEntries.map((s) => ({
                account: s.account, profession: s.profession, professionList: s.professionList ?? [],
                offenseTotals: s.offenseTotals as any, offenseRateWeights: s.offenseRateWeights, totalFightMs: s.totalFightMs,
        })),
        defensePlayers: playerEntries.map((s) => ({
                account: s.account, profession: s.profession, professionList: s.professionList ?? [],
                defenseTotals: s.defenseTotals as any, totalFightMs: s.totalFightMs,
        })),
        damageMitigationPlayers: serializeDamageMitigationPlayers(agg),
        damageMitigationMinions: serializeDamageMitigationMinions(agg),
        supportPlayers: playerEntries.map((s) => ({
                account: s.account, profession: s.profession, professionList: s.professionList ?? [],
                supportTotals: s.supportTotals as any, activeMs: s.supportActiveMs, logsJoined: s.logsJoined,
        })),
        // computeAllIncomingHealing expects the raw Elite Insights details object,
        // not the { details } wrapper validLogs uses elsewhere (that wrapper shape
        // exists for computePlayerAggregation's internal bookkeeping). Passing the
        // wrapper itself made every call return [] silently - no error, no test
        // failure, just an empty Survival Support panel on every report. Caught in
        // pre-push audit before this shipped.
        survivalSupport: mergeSurvivalSupport(validLogs.map((log: any) => computeAllIncomingHealing(log.details))),
        healingPlayers: playerEntries.map((s) => ({
                account: s.account, profession: s.profession, professionList: s.professionList ?? [],
                healingTotals: s.healingTotals as any, activeMs: s.healingActiveMs, hasHealAddon: s.hasHealAddon,
                healingCoverage: resolveHealingCoverage(s.hasHealAddon, Number(s.healingTotals?.healing ?? 0)),
        })),
        generalPlayers: playerEntries.map((s) => ({
                account: s.account, profession: s.profession, professionList: s.professionList ?? [],
                totalFightMs: s.totalFightMs, squadActiveMs: s.squadActiveMs,
                totalDist: s.totalDist, distCount: s.distCount, logsJoined: s.logsJoined, stackedLogCount: s.stackedLogCount,
        })),
        conditionPlayers: playerEntries.map((s) => ({
                account: s.account, profession: s.profession, professionList: s.professionList ?? [],
                totalFightMs: s.totalFightMs, squadActiveMs: s.squadActiveMs, logsJoined: s.logsJoined,
                outgoingConditions: s.outgoingConditions as any, incomingConditions: s.incomingConditions as any,
        })),
        distanceToTag,
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
        fightBreakdown,
        commanderStats: { rows: commanderRows },
        roleClassifications,
        attendanceData,
        boonUptimes: buffCategoryUptimes['Boons'] ?? { columns: [], rows: [] },
        buffCategoryUptimes,
        damageModifiers: computeDamageModifiers(fights),
        rotations: computeRotations(fights),
        dpsGraph: computeDpsGraph(fights),
        replayFights: computeReplayFights(fights),
        synergyInsights: computeSynergyInsights(playerEntries, buffCategoryUptimes, roleClassifications, reportTotalSquadKills, reportTotalSquadDeaths, avgSquadSize),
        mechanics: computeMechanicsTimeline(fights),
        topHealingSkills: computeTopHealingSkills(fights),
        playerSkillBreakdowns: serializePlayerSkillBreakdowns(agg),
        deathRecaps: computeDeathRecaps(fights),
        fightHighlights: computeFightHighlights(fights),
        criticalEvents: persistedIntelligence.criticalEvents,
        engagementSegments: persistedIntelligence.engagementSegments,
        intelligenceFindings: persistedIntelligence.intelligenceFindings,
        // Self- vs. group- vs. squad-generation split for stacking/non-stacking
        // boons - reads Entropy's normalized boon-generation source data,
        // player.selfBuffs/groupBuffs/squadBuffs straight from the raw log (each
        // an array of { id, buffData: [{ generation, wasted }] }, confirmed
        // against EI's JsonPlayer.SelfBuffs / GroupBuffs / SquadBuffs JSON doc).
        // Answers "is this support actually generating this boon, or just
        // standing near someone who is" - dps.report shows this as its own
        // Buff Generation tab, distinct from the uptime tables in Buffs.
        buffGeneration: buildBoonTables(fights.map((f) => ({ details: f.raw }))).boonTables,
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
                appVersion: METRICS_VERSION,
                trimmedSections: ['fightBreakdown', 'commanderStats', 'mapData', 'timelineData', 'boonTables'],
        },
        stats,
  };
}
