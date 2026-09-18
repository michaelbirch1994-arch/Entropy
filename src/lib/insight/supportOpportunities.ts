import type { WvWReport } from '../../types/report';
import type { ReplayEffectTrack } from '../parseReplayData';
import type { InsightEvidence } from './evidence';

export const SUPPORT_RULE = {
  name: 'Stand Your Ground!', cooldownMs: 24000, radius: 600,
  mode: 'WvW', version: 'support-reference-v1', reviewed: '2026-09-09',
  source: 'https://wiki.guildwars2.com/wiki/%22Stand_Your_Ground%22',
  effect: 'Grants stability to allies; not evidence of an ally stunbreak or immobilize cleanse.',
};
const guardian = new Set(['Guardian', 'Firebrand', 'Dragonhunter', 'Willbender', 'Luminary']);
const normalized = (name: string) => name.replace(/["\u201c\u201d]/g, '').trim();

function stateAt(effect: ReplayEffectTrack | undefined, time: number) {
  let last = -Infinity, value: number | null = null;
  for (const [t, v] of effect?.states ?? []) {
    if (Number.isFinite(t) && Number.isFinite(v) && t <= time && t >= last) { last = t; value = v; }
  }
  return value === null ? null : value > 0;
}

/** Integrates reference recharge progress, not skill usability or verified historical rules. */
export function rechargeWindow(start: number, end: number, cooldownMs: number, effects: ReplayEffectTrack[]) {
  const alac = effects.find(e => e.name === 'Alacrity');
  const chill = effects.find(e => e.name === 'Chilled' || e.name === 'Chill');
  const resistance = effects.find(e => e.name === 'Resistance');
  const times = [...new Set([start, end, ...[alac, chill, resistance].flatMap(e => (e?.states ?? []).map(([t]) => t)).filter(t => Number.isFinite(t) && t > start && t < end)])].sort((a, b) => a - b);
  let min = 0, max = 0, earliest: number | null = null, latest: number | null = null, uncertainMs = 0;
  for (let i = 1; i < times.length; i++) {
    const t = times[i - 1], dt = times[i] - t;
    const a = stateAt(alac, t), c = stateAt(chill, t), r = stateAt(resistance, t);
    let low = 1 / 1.66, high = 1.25;
    if (c === false || r === true) { low = a === true ? 1.25 : 1; high = a === false ? 1 : 1.25; }
    else if (c === true && r === false && a === false) low = high = 1 / 1.66;
    // Overlapping modifiers and missing states are bounded rather than guessed.
    if (low !== high) uncertainMs += dt;
    if (earliest === null && max + dt * high >= cooldownMs) earliest = t + (cooldownMs - max) / high;
    if (latest === null && min + dt * low >= cooldownMs) latest = t + (cooldownMs - min) / low;
    min += dt * low; max += dt * high;
  }
  return { earliestReadyMs: earliest === null ? null : Math.round(earliest), latestReadyMs: latest === null ? null : Math.round(latest),
    uncertainEffectTimeMs: uncertainMs, status: min >= cooldownMs ? 'Recharge completed in reference scenarios' : max >= cooldownMs ? 'Recharge uncertain in reference scenarios' : 'Recharge incomplete in reference scenarios' };
}

export function buildSupportOpportunities(report: WvWReport, account: string): InsightEvidence[] {
  const rows: InsightEvidence[] = [];
  let eligibleFights = 0, assessed = 0;
  for (const fight of report.stats.rotations?.fights ?? []) {
    const actor = fight.players.find(p => p.account === account);
    if (!actor || !guardian.has(actor.profession)) continue;
    const casts = actor.casts.filter(c => normalized(report.stats.rotations?.skillMeta[c.skillId]?.name ?? '') === SUPPORT_RULE.name
      && Number.isFinite(c.castTime) && c.castTime >= 0).slice().sort((a, b) => a.castTime - b.castTime);
    if (!casts.length) continue;
    const replay = report.stats.replayFights?.find(f => f.fightId === fight.fightId);
    const provider = replay?.data.players.find(p => p.account === account);
    if (!provider || provider.inSquad === false) continue;
    eligibleFights++;
    const index = report.stats.fightBreakdown?.findIndex(f => f.id === fight.fightId) ?? -1;
    for (const target of replay!.data.players.filter(p => p.account !== account && p.inSquad === true)) {
      for (const [down] of target.downIntervals ?? []) {
        if (!Number.isFinite(down) || down < 0 || down > fight.durationMs) continue;
        const start = Math.max(0, down - 5000);
        const last = casts.filter(c => c.castTime < start).at(-1);
        if (!last) continue;
        assessed++;
        if (rows.length >= 12) continue;
        const used = casts.filter(c => c.castTime >= start && c.castTime <= down);
        const anchor = used.at(-1) ?? last;
        const progress = rechargeWindow(anchor.castTime, down, SUPPORT_RULE.cooldownMs, provider.effects ?? []);
        const overlap = [...(provider.downIntervals ?? []), ...(provider.deadIntervals ?? [])].filter(([a, b]) => a <= down && b > start);
        const mechanics = report.stats.mechanics?.fights.find(f => f.fightId === fight.fightId)?.mechanics.flatMap(m => m.events
          .filter(e => e.time >= start && e.time <= down && (e.account === account || e.account === target.account))
          .map(e => ({ name: m.def.fullName || m.def.name, account: e.account, timestampMs: e.time }))).slice(0, 16) ?? [];
        const effects = (who: typeof provider) => (who.effects ?? []).filter(e => ['Stability', 'Aegis', 'Resistance', 'Chilled', 'Chill', 'Immobilized', 'Immobile', 'Fear', 'Taunt'].includes(e.name))
          .map(e => ({ name: e.name, icon: e.icon, stateAtWindowStart: stateAt(e, start), changes: e.states.filter(([t]) => t > start && t <= down).slice(0, 12) }));
        rows.push({ id: '', label: 'Support opportunity review (conditional cooldown)',
          ...(index >= 0 ? { replay: { fightIndex: index, timestampMs: start, account } } : {}),
          data: { account, profession: actor.profession, teammate: target.account, fightName: fight.fightName,
            name: SUPPORT_RULE.name, skillId: last.skillId, icon: report.stats.rotations?.skillMeta[last.skillId]?.icon,
            windowStartMs: start, downTimeMs: down, lastCastMs: anchor.castTime,
            recordedUsesInWindow: used.length, castTimesMs: used.map(c => c.castTime), referenceRecharge: progress,
            review: used.length ? 'Skill use recorded in danger window; do not describe it as unused.' : 'No skill use recorded in the five seconds before this down; an opportunity is not established.',
            providerSurvival: overlap.length ? 'Recorded down/dead interval overlaps danger window' : 'No down/dead overlap recorded; ability to act remains unknown',
            providerEffects: effects(provider), teammateEffects: effects(target), recordedMechanics: mechanics,
            actualAvailability: 'Unknown', rescueOutcome: 'Not established', rangeAssessment: 'Unknown: replay positions are not calibrated here to skill-range units.',
            referenceRule: SUPPORT_RULE,
            assumptions: ['Reference cooldown starts at the recorded instant shout cast. Cast completion and log completeness are not certified.',
              'No trait reductions, resets, loadout changes or special recharge modifiers. This reference is not certified for the fight balance patch.',
              'Alacrity-only progresses at 1.25/s; unopposed chill at 1/1.66 per second. Missing or overlapping modifiers retain a range.',
              'An earlier observed cast establishes use in this fight, not continuous skill availability.'],
            limitations: ['Mechanics entries are observed events, not a complete CC timeline.', 'Stability can prevent some control effects but does not remove immobilize or prove prevention of lethal damage.',
              'Range, line of sight, target cap, subgroup priority, reaction time, animation and full control state remain unresolved.',
              'Never infer negligence, a missed save, or a probability from this record.'],
          } });
      }
    }
  }
  return [{ id: '', label: 'Support opportunity coverage', data: { supportedSkills: [SUPPORT_RULE.name], eligibleFights, assessedWindows: assessed,
    includedWindows: rows.length, scope: 'Selected provider; squad teammate downs with a prior recorded cast. Other skills and missing anchors are not assessed.' } }, ...rows];
}
