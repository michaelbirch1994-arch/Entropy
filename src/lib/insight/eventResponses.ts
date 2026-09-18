import type { WvWReport } from '../../types/report';
import type { CombatMoment } from './combatConnections';
import { assessCooldownInterval } from './cooldownModifiers';
import { responseReach } from './responseReach';

export type ResponseKind = 'revive' | 'stunbreak' | 'cleanse' | 'unknown';
interface ResponseRule { name: string; kind: ResponseKind; cooldownMs: number | null; maxReach: number | null; response: string; source: string; assumedProfession?: string; skillId?: number; aliases?: string[]; preventionOnly?: boolean }
export const RESPONSE_RULES: ResponseRule[] = [
  { name: 'Signet of Mercy', kind: 'revive', cooldownMs: 90000, maxReach: 1080, response: 'Revives a downed ally; ground placement and successful revival are not established.', source: 'https://wiki.guildwars2.com/wiki/Signet_of_Mercy' },
  { name: 'Battle Standard', kind: 'revive', cooldownMs: 120000, maxReach: null, response: 'Revives downed allies; cast completion, banner arrival and recipients are not established.', source: 'https://wiki.guildwars2.com/wiki/Battle_Standard' },
  { name: 'Eye of the Storm!', kind: 'stunbreak', cooldownMs: 30000, maxReach: 600, response: 'Breaks stun for nearby allies. Self-only stunbreaks are not substitutes.', source: 'https://wiki.guildwars2.com/wiki/%22Eye_of_the_Storm%21%22' },
  { name: 'Purging Flames', kind: 'cleanse', cooldownMs: 28000, maxReach: 1080, response: 'Removes conditions from allies in the ground-targeted area. Removal of this specific condition is not guaranteed.', source: 'https://wiki.guildwars2.com/wiki/Purging_Flames' },
  { name: 'Null Field', kind: 'cleanse', cooldownMs: 45000, maxReach: 1140, response: 'Removes conditions from allies in the ground-targeted field. Removal of this specific condition is not guaranteed.', source: 'https://wiki.guildwars2.com/wiki/Null_Field' },
  { name: 'Mantra of Liberation', kind: 'stunbreak', cooldownMs: null, maxReach: 450, assumedProfession: 'Firebrand', skillId: 43357, aliases: ['Portent of Freedom', 'Unhindered Delivery'], response: 'Prepared charges break allied stuns. Preparation, remaining charges and cone facing must be resolved; a single last-cast cooldown is not valid for this mantra.', source: 'https://wiki.guildwars2.com/wiki/Mantra_of_Liberation' },
  { name: 'Stand Your Ground!', kind: 'stunbreak', cooldownMs: 24000, maxReach: 600, assumedProfession: 'Firebrand', skillId: 9153, preventionOnly: true, response: 'Allied stability is preventive. The stunbreak affects the caster only, so this cannot remove an ally\'s existing stun.', source: 'https://wiki.guildwars2.com/wiki/%22Stand_Your_Ground!%22' },
  { name: 'Spirit of Nature', kind: 'revive', cooldownMs: 120000, maxReach: 960, assumedProfession: 'Druid', skillId: 12569, response: 'Summons the spirit whose Nature\'s Renewal slam revives downed allies. Summon completion, slam timing and spirit placement remain unresolved.', source: 'https://wiki.guildwars2.com/wiki/Spirit_of_Nature' },
];
const normalize = (value: string) => value.replace(/["\u201c\u201d]/g, '').trim();
const CONTROL_LABEL = /^(?:stun(?:ned)?|daze(?:d)?|fear(?:ed)?|taunt(?:ed)?|float(?:ed)?|sink(?:ing)?|launch(?:ed)?|pull(?:ed)?|knock(?:ed)?[ -]?(?:down|back)(?:\/pulled)?|lockout(?:\s*\(.*\))?|cc|crowd control)$/i;
export function responseKind(event: CombatMoment): ResponseKind {
  const label = event.label.trim();
  if (event.kind === 'down' || /^(?:downed|downstate)$/i.test(label)) return 'revive';
  if (event.kind !== 'mechanic') return 'unknown';
  if (/^(immobili[sz]e[ds]?|immobili[sz]ation|cripple[ds]?|chill(?:ed)?|slow(?:ed)?|weakness|blind(?:ed|ness)?|poison(?:ed)?|burning|bleeding|confusion|torment|vulnerability)$/i.test(label)) return 'cleanse';
  return label.split(/\s*[/|·]\s*/).some(part => CONTROL_LABEL.test(part)) ? 'stunbreak' : 'unknown';
}

export function eventResponses(report: WvWReport, fightId: string, event: CombatMoment, kind: ResponseKind) {
  const fight = report.stats.rotations?.fights.find(f => f.fightId === fightId);
  const replay = report.stats.replayFights?.find(f => f.fightId === fightId);
  const target = replay?.data.players.find(p => p.account === event.account && p.inSquad === true);
  const rules = RESPONSE_RULES.filter(rule => rule.kind === kind);
  const candidates = [];
  if (fight && target && event.kind !== 'death' && Number.isFinite(event.time) && event.time >= 0 && event.time <= fight.durationMs) {
    const providers = [...fight.players];
    for (const p of replay?.data.players ?? []) {
      if (p.inSquad && !providers.some(other => other.account === p.account)) providers.push({ account: p.account, profession: p.profession, professionList: [p.profession], casts: [] });
    }
    for (const player of providers) {
      if (player.account === target.account) continue;
      const track = replay?.data.players.find(p => p.account === player.account && p.inSquad === true);
      if (!track) continue;
      for (const rule of rules) {
        const assumedEquipped = rule.assumedProfession === player.profession;
        const observedCasts = player.casts.filter(c => [rule.name, ...(rule.aliases ?? [])].includes(normalize(report.stats.rotations?.skillMeta[c.skillId]?.name ?? '')))
          .filter(c => Number.isFinite(c.castTime) && c.castTime >= 0 && c.castTime <= fight.durationMs).slice().sort((a, b) => a.castTime - b.castTime);
        if (!observedCasts.length && !assumedEquipped) continue;
        // Preparing a mantra is not the allied stunbreak activation.
        const casts = rule.aliases ? observedCasts.filter(c => rule.aliases!.includes(normalize(report.stats.rotations?.skillMeta[c.skillId]?.name ?? ''))) : observedCasts;
        const skillId = observedCasts[0]?.skillId ?? rule.skillId ?? null;
        const loadoutEvidence = observedCasts.length ? 'Observed in this fight' : 'Assumed equipped: user-defined meta loadout';
        const last = casts.filter(c => c.castTime < event.time).at(-1);
        const atEvent = casts.some(c => c.castTime === event.time);
        const targetDeath = Math.min(Infinity, ...(target.deadIntervals ?? []).filter(([start, end]) => end > event.time && start <= event.time + 5000).map(([start]) => start));
        const eligibilityEnd = Math.min(event.end ?? Infinity, targetDeath);
        const responseEnd = Math.max(event.time, Math.min(fight.durationMs, event.time + 5000, eligibilityEnd));
        const following = casts.filter(c => c.castTime >= event.time && c.castTime <= responseEnd && c.castTime < eligibilityEnd);
        const blocked = [...(track.downIntervals ?? []), ...(track.deadIntervals ?? [])].some(([start, end]) => start <= event.time && end > event.time);
        const cooldownAt = (anchor: typeof last, timeMs: number) => anchor && rule.cooldownMs !== null && skillId !== null
          ? assessCooldownInterval(anchor.castTime, timeMs, rule.cooldownMs, {
              casts: player.casts,
              skillId,
              skillName: rule.name,
              profession: player.profession,
              skillMeta: report.stats.rotations?.skillMeta,
              effects: track.effects ?? [],
              effectTimelineComplete: Boolean(track.effects?.length),
              gameMode: 'wvw',
            })
          : null;
        const recharge = cooldownAt(last, event.time);
        const status = blocked ? 'Incapacitated at event' : atEvent ? 'Cast recorded at event' : rule.cooldownMs === null ? 'Mantra charges unresolved' : !last ? 'No prior cast anchor' : recharge?.status === 'ready' ? 'Estimated recharged' : recharge?.status === 'uncertain' ? 'Recharge uncertain' : 'Estimated recharging';
        const reach = responseReach(track, target, event.time, replay?.data.map?.inchToPixel, rule.maxReach);
        const matchesEvent = responseKind(event) === kind && !rule.preventionOnly;
        const survivalKnown = Array.isArray(track.downIntervals) && Array.isArray(track.deadIntervals);
        const targetDead = (target.deadIntervals ?? []).some(([start, end]) => start <= event.time && end > event.time);
        const verdict = rule.preventionOnly ? 'Prevention only, not an ally stunbreak' : !matchesEvent ? 'Response mismatch' : targetDead ? 'Target already defeated' : blocked ? 'Provider incapacitated' : atEvent ? 'Response cast recorded' : reach.status === 'Outside reference reach' ? 'Outside reference reach' : status === 'Estimated recharging' ? 'Recharging in reference model' : status === 'Estimated recharged' && reach.status === 'Within reference reach' && survivalKnown ? 'Potential help opportunity' : 'Insufficient evidence';
        const opportunity = { verdict, scope: 'At the event timestamp', response: rule.response, reach,
          reasons: [loadoutEvidence, matchesEvent ? `Skill addresses this ${kind} event.` : 'The skill does not remove this recorded mechanic.', status,
            recharge ? `${recharge.coveragePct}% of cooldown evidence is modeled; ${recharge.modifiers.filter(modifier => modifier.applied).length} modifier${recharge.modifiers.filter(modifier => modifier.applied).length === 1 ? '' : 's'} applied.` : 'A cooldown interval could not be established.',
            reach.distanceUnits === null ? 'Position or map calibration is missing.' : `Estimated separation: ${reach.distanceUnits} units; reference maximum reach: ${reach.maxReachUnits ?? 'unverified'}.`,
            survivalKnown ? blocked ? 'Provider down/dead interval overlaps the event.' : 'No provider down/dead interval overlaps the event.' : 'Provider survival records are missing.'],
          unresolved: ['Current loadout and unobserved trait, sigil, trigger, charge and resource state.', 'Full control state, line of sight, elevation, target priority and actual recipients.', 'A potential opportunity is not proof of a missed save.'] };
        const evidenceChecks = [
          { label: 'Event matches the supported response type', available: Boolean(matchesEvent) },
          { label: 'Prior skill cast timestamp recorded', available: Boolean(last) },
          { label: 'Continuous effect timeline supplied for recharge modifiers', available: Boolean(recharge && track.effects?.length) },
          { label: 'Down/dead interval records supplied', available: Array.isArray(track.downIntervals) && Array.isArray(track.deadIntervals) },
          { label: 'Fight patch, traits and resets verified', available: false },
          { label: 'Current skill access verified', available: false },
          { label: 'Range, line of sight and target eligibility verified', available: false },
          { label: 'Full control and animation state verified', available: false },
        ];
        const completedChecks = evidenceChecks.filter(check => check.available).length;
        // Sample recorded time, not a hypothetical changed cast history. Include actual casts
        // so a new activation resets the reference estimate at the next checkpoint.
        const checkpoints = [...new Set([
          ...Array.from({ length: 6 }, (_, i) => event.time + i * 1000),
          ...following.slice(0, 20).map(c => c.castTime),
        ])].filter(time => time <= responseEnd && time < eligibilityEnd).sort((a, b) => a - b);
        const responseTimeline = checkpoints.map(time => {
          const anchor = casts.filter(c => c.castTime < time).at(-1);
          const castRecorded = casts.some(c => c.castTime === time);
          const incapacitated = [...(track.downIntervals ?? []), ...(track.deadIntervals ?? [])].some(([start, end]) => start <= time && end > time);
          const estimate = cooldownAt(anchor, time);
          return { timeMs: time, offsetMs: time - event.time, lastCastMs: anchor?.castTime ?? null, castRecorded,
            status: incapacitated ? 'Recorded incapacitation' : castRecorded ? 'Recorded cast' : rule.cooldownMs === null ? 'Mantra charges unresolved' : !estimate ? 'No prior cast anchor' : estimate.status === 'ready' ? 'Estimated recharged' : estimate.status === 'uncertain' ? 'Recharge uncertain' : 'Estimated recharging' };
        });
        const explanations = [
          { title: 'Recharge constrained the response', assessment: status === 'Estimated recharging' ? 'Supported in evidence model' : status === 'Estimated recharged' ? 'Counterevidence in evidence model' : 'Unresolved', evidence: rule.cooldownMs === null ? 'Mantra preparation and charge state require a separate model.' : last ? `Prior cast at ${last.castTime} ms; reference recharge ${rule.cooldownMs} ms; cooldown evidence coverage ${recharge?.coveragePct ?? 0}%.` : 'No earlier cast anchors the cooldown.', limitation: 'Observed Alacrity, Chill and Resistance are applied. Unverified trait, sigil and event-triggered modifiers remain bounded candidates.' },
          { title: 'Provider was incapacitated', assessment: blocked ? 'Recorded' : Array.isArray(track.downIntervals) && Array.isArray(track.deadIntervals) ? 'No down/dead overlap recorded' : 'Unresolved', evidence: blocked ? 'A provider down/dead interval overlaps the event.' : 'No overlapping down/dead interval found.', limitation: 'This does not resolve stun, silence, animation locks or other access restrictions.' },
          { title: 'A response cast was recorded', assessment: following.length ? 'Recorded' : 'Not observed', evidence: following.length ? `${following.length} cast(s) recorded in the next response window.` : 'No matching cast appears in the response window.', limitation: 'Recipients, completed activation and impact are unknown; absence is not evidence of negligence.' },
          { title: 'Position or skill access prevented help', assessment: reach.status === 'Outside reference reach' ? 'Outside reference reach' : 'Unresolved', evidence: reach.distanceUnits === null ? 'Position evidence is unavailable; skill access and recipient eligibility remain unknown.' : `2D separation is approximately ${reach.distanceUnits} units (${reach.status.toLowerCase()}). Skill access and recipient eligibility remain unknown.`, limitation: 'Estimated recharge and 2D reach alone cannot establish a usable rescue opportunity.' },
        ];
        candidates.push({ account: player.account, profession: player.profession, skillId, name: rule.name, loadoutEvidence,
          icon: skillId === null ? undefined : report.stats.rotations?.skillMeta[skillId]?.icon, status, lastCastMs: last?.castTime ?? null,
          referenceCooldownMs: rule.cooldownMs, recharge, responseEndMs: responseEnd, explanations, responseTimeline, opportunity,
          recordedFollowingCastsMs: following.map(c => c.castTime), source: rule.source,
          evidenceCoverage: { percent: Math.round(completedChecks / evidenceChecks.length * 100), completedChecks, totalChecks: evidenceChecks.length, checks: evidenceChecks },
          actualAvailability: recharge ? `${recharge.coveragePct}% cooldown evidence coverage. Overall usability remains unverified because range, skill access, completion, full control state and target priority are separate requirements.` : 'Cooldown evidence coverage unavailable. Overall usability remains unverified.',
        });
      }
    }
  }
  return { event, kind, targetResolved: Boolean(target), rotationAvailable: Boolean(fight), candidates,
    supportedSkills: rules.map(r => r.name), referenceMode: 'WvW reference / reviewed 2026-09-10',
    metaAssumptions: ['Firebrand: Mantra of Liberation and Stand Your Ground!', 'Druid: Spirit of Nature', 'Equipped is assumed, not readiness, mantra preparation or remaining charges.'],
    limitations: ['Supported recorded skills and user-defined Firebrand/Druid loadout assumptions are assessed. Other never-cast skills remain unknown.',
      'Recharge estimates apply recorded Alacrity, Chill and Resistance plus provable profession mechanics. Unverified traits, sigils, triggers and loadout changes remain candidates.',
      'No cast recorded in the response window does not prove non-use, negligence, or that the teammate could have been saved.',
      'Range, line of sight, actual recipients, reaction time and full control state are not established. Self-only stunbreaks are excluded.'],
  };
}
