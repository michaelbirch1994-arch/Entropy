import type { WvWReport } from '../../types/report';
import { buildEnduranceEvidence } from './endurance';
import { buildSupportOpportunities } from './supportOpportunities';

export interface InsightEvidence {
  id: string;
  label: string;
  data: unknown;
  replay?: { fightIndex: number; timestampMs: number; account: string };
}

const EVIDENCE_TARGET_BYTES = 140_000;

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function topByValue<T>(items: T[] | undefined, value: (item: T) => number | undefined, limit: number) {
  return [...(items ?? [])].sort((a, b) => (value(b) ?? 0) - (value(a) ?? 0)).slice(0, limit);
}

function compactTotals(totals: object | undefined, keys: string[]) {
  if (!totals) return null;
  const source = totals as Record<string, unknown>;
  return Object.fromEntries(keys.map(key => [key, source[key]]).filter(([, value]) => typeof value === 'number'));
}

function compactSkillBreakdown(breakdown: unknown) {
  const b = breakdown as { account?: string; profession?: string; damage?: unknown[]; healing?: unknown[]; barrier?: unknown[] } | undefined;
  if (!b) return undefined;
  const compactSources = (items: unknown[] | undefined) => topByValue(items as { id?: string; name?: string; icon?: string; value?: number; hits?: number; downContribution?: number }[] | undefined, item => item.value, 15)
    .map(item => ({ id: item.id, name: item.name, icon: item.icon, value: item.value, hits: item.hits, downContribution: item.downContribution }));
  return { account: b.account, profession: b.profession, damage: compactSources(b.damage), healing: compactSources(b.healing), barrier: compactSources(b.barrier) };
}

function compactDeathRecap(d: { account: string; profession?: string; characterName?: string; fightName?: string; fightIndex: number; deathTimeMs: number; toDown?: unknown[]; toKill?: unknown[] }) {
  const hits = (items: unknown[] | undefined) => topByValue(items as { id?: number; name?: string; icon?: string; src?: string; damage?: number; time?: number; isIndirect?: boolean }[] | undefined, item => item.damage, 6)
    .map(item => ({ id: item.id, name: item.name, icon: item.icon, src: item.src, damage: item.damage, time: item.time, isIndirect: item.isIndirect }));
  const total = (items: unknown[] | undefined) => (items as { damage?: number }[] | undefined)?.reduce((sum, item) => sum + (item.damage ?? 0), 0) ?? 0;
  return { account: d.account, profession: d.profession, characterName: d.characterName, fightName: d.fightName, fightIndex: d.fightIndex, deathTimeMs: d.deathTimeMs,
    toDownTotal: total(d.toDown), toKillTotal: total(d.toKill), strongestToDown: hits(d.toDown), strongestToKill: hits(d.toKill) };
}

function fitEvidence(rows: InsightEvidence[]) {
  let fitted = rows;
  const trimOrder = [
    'Recorded casts by fight (counts do not prove missed opportunities)',
    'Boon and condition state around a recorded down',
    'Recorded survival intervals',
    'Existing findings (retain their original confidence)',
    'Comparison context (not a fair ranking without matching participation and role)',
  ];
  for (const label of trimOrder) {
    while (bytes(fitted) > EVIDENCE_TARGET_BYTES && fitted.some(row => row.label === label)) {
      const index = fitted.map(row => row.label).lastIndexOf(label);
      fitted = fitted.filter((_, i) => i !== index);
    }
  }
  if (bytes(fitted) > EVIDENCE_TARGET_BYTES) {
    fitted = fitted.map(row => bytes(row) > 18_000 ? { ...row, data: { omitted: true, reason: 'This evidence record was too large for the AI request budget.', label: row.label } } : row);
  }
  return fitted.map((row, index) => ({ ...row, id: `E${index + 1}` }));
}

/** A read-only projection. No parser or metric calculations are changed. */
export function buildInsightEvidence(report: WvWReport, account: string) {
  const s = report.stats;
  const rows: InsightEvidence[] = [];
  rows.push(...buildEnduranceEvidence(report, account));
  rows.push(...buildSupportOpportunities(report, account));
  const add = (label: string, data: unknown, replay?: InsightEvidence['replay']) => {
    if (data !== undefined && data !== null) rows.push({ id: `E${rows.length + 1}`, label, data, replay });
  };
  const player = <T extends { account: string }>(items?: T[]) => items?.find(p => p.account === account);
  add('Report scope', { title: report.meta.title, fightsAvailable: s.fightBreakdown?.length ?? 0, fights: s.fightBreakdown?.slice(0, 40).map((f, i) => ({ fightIndex: i, id: f.id, label: f.label, mapName: f.mapName, duration: f.duration, isWin: f.isWin, squadCount: f.squadCount, enemyCount: f.enemyCount, alliesDead: f.alliesDead, enemyDeaths: f.enemyDeaths, outgoingDamage: f.totalOutgoingDamage, incomingDamage: f.totalIncomingDamage })), selectedAccount: account,
    limitations: ['Aggregate metrics are not event timelines.', 'Active time is not guaranteed to mean alive time.', 'Subgroup may change between fights.', 'Role classification is an estimate.', 'Missing data is unknown, not zero.'] });
  add('Role estimate', player(s.roleClassifications));
  add('Attendance and subgroup (report aggregate)', player(s.attendanceData));
  const offense = player(s.offensePlayers);
  add('Outgoing damage (report aggregate)', offense && { account: offense.account, profession: offense.profession, totalFightMs: offense.totalFightMs, offenseTotals: compactTotals(offense.offenseTotals, ['damage', 'downContribution', 'againstDownedDamage', 'appliedCrowdControl', 'boonStrips', 'killed', 'downed', 'interrupted', 'blocked', 'evaded']) });
  const defense = player(s.defensePlayers);
  add('Incoming damage and defense (report aggregate)', defense && { account: defense.account, profession: defense.profession, totalFightMs: defense.totalFightMs, defenseTotals: compactTotals(defense.defenseTotals, ['damageTaken', 'conditionDamageTaken', 'powerDamageTaken', 'damageTakenCount']) });
  const healing = player(s.healingPlayers);
  if (healing) add('Healing and recording coverage', { account: healing.account, profession: healing.profession, activeMs: healing.activeMs, healingCoverage: healing.healingCoverage ?? (healing.hasHealAddon ? 'full' : 'unknown'), healingTotals: compactTotals(healing.healingTotals, ['healing', 'squadHealing', 'groupHealing', 'selfHealing', 'barrier', 'squadBarrier', 'groupBarrier', 'selfBarrier', 'downedHealing', 'squadDownedHealing']) });
  const support = player(s.supportPlayers);
  add('Support actions (report aggregate)', support && { account: support.account, profession: support.profession, activeMs: support.activeMs, logsJoined: support.logsJoined, supportTotals: compactTotals(support.supportTotals, ['condiCleanse', 'boonStrips', 'stunBreak', 'resurrects', 'boonStripDownContribution', 'removedStunDuration', 'resurrectTime']) });
  add('Activity and distance (report aggregate)', player(s.generalPlayers));
  const boons = player(s.boonUptimes?.rows);
  if (boons) add('Received boons (report aggregate, not timestamped)', { group: boons.group, logsJoined: boons.logsJoined,
    boons: s.boonUptimes!.columns.map(b => ({ name: b.name, icon: b.icon, value: boons.uptimes[b.id] ?? null, unit: b.stacking ? 'average stacks' : 'percent' })) });
  add('Recorded skill contributions (not equipped-skill availability)', compactSkillBreakdown(s.playerSkillBreakdowns?.[account]));
  add('Comparison context (not a fair ranking without matching participation and role)', (s.offensePlayers ?? []).slice(0, 50).map(p => {
    const h = s.healingPlayers?.find(x => x.account === p.account);
    return { account: p.account, profession: p.profession, role: s.roleClassifications?.find(x => x.account === p.account),
      damage: p.offenseTotals.damage, downContribution: p.offenseTotals.downContribution, totalFightMs: p.totalFightMs, attendance: s.attendanceData?.find(x => x.account === p.account),
      healing: h ? { total: h.healingTotals.squadHealing, activeMs: h.activeMs, coverage: h.healingCoverage ?? (h.hasHealAddon ? 'full' : 'unknown') } : null };
  }));
  const deaths = (s.deathRecaps ?? []).filter(d => d.account === account);
  deaths.slice(0, 12).forEach(d => add('Recorded death recap', compactDeathRecap(d), { fightIndex: d.fightIndex, timestampMs: d.deathTimeMs, account }));
  add('Death evidence coverage', { total: deaths.length, included: Math.min(deaths.length, 12) });
  const findings = (s.intelligenceFindings ?? []).filter(f => f.relatedPlayers?.includes(account));
  add('Existing findings (retain their original confidence)', findings.slice(0, 20));
  for (const fight of (s.replayFights ?? []).slice(0, 4)) {
    const track = player(fight.data.players);
    if (!track) continue;
    const fightIndex = s.fightBreakdown?.findIndex(f => f.id === fight.fightId) ?? -1;
    add('Recorded survival intervals', { fightId: fight.fightId, durationMs: fight.data.durationMs, downIntervals: (track.downIntervals ?? []).slice(0, 12), deadIntervals: (track.deadIntervals ?? []).slice(0, 12) });
    for (const [start] of (track.downIntervals ?? []).slice(0, 2)) {
      const windowStart = Math.max(0, start - 10000);
      const windowEnd = Math.min(fight.data.durationMs, start + 3000);
      add('Boon and condition state around a recorded down', { fightId: fight.fightId, windowStart, windowEnd, downTimeMs: start,
        effects: (track.effects ?? []).map(effect => ({ name: effect.name, classification: effect.classification,
          stateAtWindowStart: [...effect.states].reverse().find(([t]) => t <= windowStart) ?? null,
          changes: effect.states.filter(([t]) => t > windowStart && t <= windowEnd).slice(0, 8) })).filter(effect => effect.stateAtWindowStart || effect.changes.length).slice(0, 24),
        nearbyCasts: (track.casts ?? []).filter(c => c.t >= windowStart && c.t <= windowEnd).slice(0, 24).map(c => ({ t: c.t, skillId: c.skillId, name: fight.data.skillMeta[c.skillId]?.name })),
        limitations: ['An empty effect list is not proof of boon absence.', 'These cast markers only include damaging skills.', 'Hard control may not be recorded.'] },
        fightIndex >= 0 ? { fightIndex, timestampMs: start, account } : undefined);
    }
  }
  for (const fight of (s.rotations?.fights ?? []).slice(0, 10)) {
    const p = player(fight.players);
    if (!p) continue;
    const counts = new Map<number, number>();
    p.casts.forEach(c => counts.set(c.skillId, (counts.get(c.skillId) ?? 0) + 1));
    add('Recorded casts by fight (counts do not prove missed opportunities)', { fightId: fight.fightId, fightName: fight.fightName,
      durationMs: fight.durationMs, activeMs: p.activeMs,
      skills: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([id, casts]) => ({ id, name: s.rotations?.skillMeta[id]?.name ?? `Skill ${id}`, icon: s.rotations?.skillMeta[id]?.icon, casts })) });
  }
  add('Analysis boundaries', { rotationFightsIncluded: Math.min(s.rotations?.fights.length ?? 0, 10), rotationFightsAvailable: s.rotations?.fights.length ?? 0,
    replayFightsIncluded: Math.min(s.replayFights?.length ?? 0, 4), replayFightsAvailable: s.replayFights?.length ?? 0, downWindowsPerFightLimit: 2,
    unavailable: ['Equipped skills and exact cooldown availability', 'Reliable endurance history', 'Complete hard-control / interrupt timeline', 'Timestamped incoming healing attribution', 'Exact healing opportunity', 'Verified skill mechanics for the current balance patch'],
    rules: ['Do not call a dodge wasted merely because no evade was recorded.', 'Do not infer interruptions from missing stability.', 'Do not equate low healing with poor play when recording is partial.', 'Do not assign intent, inexperience, or blame from casts alone.'] });
  return fitEvidence(rows);
}
