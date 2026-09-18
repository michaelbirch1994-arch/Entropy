import type { WvWReport } from '../../types/report';
import type { InsightEvidence } from './evidence';
import { normalizeEvidenceProvenance } from './provenance';

type State = [number, number];
export const ENDURANCE_RULES = {
  version: 'standard-scenario-v1', reviewed: '2026-09-09', cost: 50, capacity: 100,
  source: 'https://wiki.guildwars2.com/wiki/Endurance',
};
const supported = new Set(['Guardian', 'Firebrand', 'Dragonhunter', 'Willbender', 'Warrior', 'Berserker', 'Spellbreaker', 'Bladesworn', 'Ranger', 'Druid', 'Soulbeast', 'Untamed', 'Necromancer', 'Reaper', 'Scourge', 'Harbinger', 'Elementalist', 'Tempest', 'Weaver', 'Catalyst', 'Engineer', 'Scrapper', 'Holosmith', 'Mechanist', 'Mesmer', 'Chronomancer', 'Virtuoso', 'Revenant', 'Herald', 'Renegade', 'Thief', 'Deadeye', 'Specter']);

function active(states: State[], time: number): boolean | null {
  let value: number | null = null;
  for (const [t, amount] of states) { if (t > time) break; value = amount; }
  return value === null ? null : value > 0;
}

/** Conditional scenario only: complete dodge records, no refunds or extra modifiers. */
export function enduranceScenario(start: number, end: number, vigor: State[], weakness: State[]) {
  const clean = (states: State[]) => states.filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v)).slice().sort((a, b) => a[0] - b[0]);
  const v = clean(vigor), w = clean(weakness);
  const times = [...new Set([start, end, ...[...v, ...w].map(([t]) => t).filter(t => t > start && t < end)])].sort((a, b) => a - b);
  let lower = 0, upper = 50, unknownMs = 0;
  for (let i = 1; i < times.length; i++) {
    const elapsed = Math.max(0, times[i] - times[i - 1]);
    const hasVigor = active(v, times[i - 1]), hasWeakness = active(w, times[i - 1]);
    let low = 2.5, high = 7.5;
    if (hasVigor !== null && hasWeakness !== null && !(hasVigor && hasWeakness)) {
      low = high = hasWeakness ? 2.5 : hasVigor ? 7.5 : 5;
    } else unknownMs += elapsed;
    lower = Math.min(100, lower + low * elapsed / 1000);
    upper = Math.min(100, upper + high * elapsed / 1000);
  }
  return { lower: Math.round(lower * 10) / 10, upper: Math.round(upper * 10) / 10, uncertainEffectTimeMs: unknownMs };
}

export function buildEnduranceEvidence(report: WvWReport, account: string): InsightEvidence[] {
  const rows: InsightEvidence[] = [];
  for (const fight of report.stats.replayFights ?? []) {
    const player = fight.data.players.find(p => p.account === account);
    if (!player) continue;
    const rotation = report.stats.rotations?.fights.find(f => f.fightId === fight.fightId)?.players.find(p => p.account === account);
    const dodges = [...new Set((rotation?.casts ?? []).filter(c => report.stats.rotations?.skillMeta[c.skillId]?.name === 'Dodge')
      .map(c => c.castTime).filter(Number.isFinite))].sort((a, b) => a - b);
    const fightIndex = report.stats.fightBreakdown?.findIndex(f => f.id === fight.fightId) ?? -1;
    for (const [time] of player.downIntervals ?? []) {
      if (!Number.isFinite(time) || time < 0 || time > fight.data.durationMs) continue;
      const last = dodges.filter(t => t >= 0 && t < time).at(-1);
      const interrupted = last !== undefined && [...(player.downIntervals ?? []), ...(player.deadIntervals ?? [])].some(([a, b]) => a < time && b > last);
      const valid = supported.has(player.profession) && last !== undefined && !interrupted && !dodges.includes(time);
      const scenario = valid ? enduranceScenario(last!, time,
        player.effects?.find(e => e.name === 'Vigor')?.states ?? [],
        player.effects?.find(e => e.name === 'Weakness')?.states ?? []) : null;
      rows.push({ id: '', label: 'Endurance before down (conditional estimate)',
        ...(fightIndex >= 0 ? { replay: { fightIndex, timestampMs: time, account } } : {}),
        provenance: normalizeEvidenceProvenance([
          { id: 'endurance-down', kind: 'recorded-event', label: 'Down and dodge timestamps',
            detail: `Down at ${time} ms${last === undefined ? '; no prior Dodge cast was recorded.' : `; prior Dodge cast at ${last} ms.`}`, source: 'https://github.com/baaron4/GW2-Elite-Insights-Parser' },
          scenario && { id: 'endurance-effects', kind: 'parser-derived-state', label: 'Vigor and Weakness states',
            detail: `${scenario.uncertainEffectTimeMs} ms of the interval retains unresolved effect state.`, source: 'https://github.com/baaron4/GW2-Elite-Insights-Parser' },
          { id: 'endurance-rule', kind: 'wvw-override', label: 'Endurance reference scenario',
            detail: `${ENDURANCE_RULES.cost}-endurance dodge cost and standard regeneration bounds.`, source: ENDURANCE_RULES.source },
          { id: 'endurance-estimate', kind: 'bounded-inference', label: 'Endurance range',
            detail: scenario ? `${scenario.lower}-${scenario.upper} endurance under the stated assumptions; this is not measured endurance.` : 'No scenario range can be calculated from the captured evidence.' },
        ]),
        data: { account, profession: player.profession, fightName: fight.fightName, downTimeMs: time,
          lastRecordedDodgeMs: last ?? null, sinceLastDodgeMs: last === undefined ? null : time - last,
          actualDodgeAvailability: 'Unknown', probability: 'Not calibrated',
          scenario: scenario ? { minimumEndurance: scenario.lower, maximumEndurance: scenario.upper,
            dodgeCost: ENDURANCE_RULES.cost, uncertainEffectTimeMs: scenario.uncertainEffectTimeMs,
            conclusion: scenario.lower >= 50 ? 'Enough endurance under the stated assumptions' : 'Endurance threshold unresolved under the stated assumptions' } : null,
          unavailableReason: valid ? null : 'Missing standard dodge anchor, unsupported profession mechanics, simultaneous events, or survival-state interruption.',
          rules: ENDURANCE_RULES,
          assumptions: ['Standard 50-cost dodge and 100 capacity; 0-50 endurance immediately after the last recorded dodge.',
            'All endurance spends after the anchor are recorded; no sigil, trait, relic, food or ally refunds are included.',
            'Known vigor-only intervals use 7.5/s; weakness-only 2.5/s; neither 5/s. Missing states or overlap use a 2.5-7.5/s scenario range.',
            'Rules are a reference scenario, not a verified ruleset for this log balance patch.'],
          limitations: ['These are conditional scenario bounds, not measured endurance or a probability.',
            'Missing dodge records or additional endurance modifiers can invalidate the range.',
            'Having endurance does not prove the player could act, react in time, or evade the incoming attack.',
            'Down moments are evaluated; a later death while downed is not a dodge opportunity.'],
        } });
      if (rows.length >= 12) return rows;
    }
  }
  return rows;
}
