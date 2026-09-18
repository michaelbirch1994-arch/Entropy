import type { Gw2Skill } from '../../types/buildEditor';
import type { WvWReport } from '../../types/report';
import { firebrandTomeSkills } from '../axiforge/nestedMechanicSkills';
import { RESPONSE_RULES, responseKind } from './eventResponses';

const PRESSURE_WINDOW_MS = 5_000;
const CONTROL_PROXIMITY_MS = 750;
const RESPONSE_WINDOW_MS = 3_000;
const CONTROL_ATTEMPT_CLUSTER_MS = 100;
const STABILITY_TRANSITION_MATCH_MS = 250;
const CONDITION_SOURCE_MATCH_MS = 750;
const CONDITION_SOURCE_AMBIGUITY_MS = 75;
const CONDITION_TEMPORAL_CANDIDATE_MS = 250;
const CONDITION_TEMPORAL_AMBIGUITY_MS = 25;

const COMBAT_RESULT = {
  BLOCK: 3,
  EVADE: 4,
  ABSORB: 6,
  BLIND: 7,
  SKILL_CAST: 11,
  CROWD_CONTROL: 12,
} as const;

const normalize = (value: string) => value.replace(/["\u201c\u201d]/g, '').trim().toLowerCase();
const finite = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const ALLIED_TARGET = /\b(?:allies|nearby allies|party members|subgroup members)\b/;

export type HardControlType = 'stun' | 'daze' | 'knockdown' | 'knockback' | 'launch' | 'pull' | 'float' | 'sink' | 'fear' | 'taunt';

const HARD_CONTROL_PATTERNS: Array<[HardControlType, RegExp]> = [
  ['stun', /\bstuns?\b/],
  ['daze', /\bdazes?\b/],
  ['knockdown', /\b(?:knockdowns?|knocks? down)\b/],
  ['knockback', /\b(?:knockbacks?|knocks? back)\b/],
  ['launch', /\blaunch(?:es|ed|ing)?\b/],
  ['pull', /\bpull(?:s|ed|ing)?\b/],
  ['float', /\bfloat(?:s|ed|ing)?\b/],
  ['sink', /\bsink(?:s|ing)?\b/],
  ['fear', /\bfear(?:s|ed|ing)?\b/],
  ['taunt', /\btaunt(?:s|ed|ing)?\b/],
];

function controlText(values: Array<string | undefined>) {
  return values.flatMap(value => (value ?? '').split(/[.!?\n]+/)).map(value => normalize(value)).filter(value => value
    && !/\b(?:breaks?|removes?|cleanses?)\s+(?:an?\s+)?stuns?\b/.test(value)
    && !/\bstun\s*break\b/.test(value));
}

export function hardControlReference(skill: Gw2Skill) {
  const baseFacts = skill.facts ?? [];
  const traitedFacts = skill.traited_facts ?? [];
  const baseSegments = controlText(baseFacts.flatMap(fact => [fact.text, fact.status, fact.description]));
  const traitedSegments = controlText(traitedFacts.flatMap(fact => [fact.text, fact.status, fact.description]));
  const descriptionSegments = controlText([skill.description]);
  const types = HARD_CONTROL_PATTERNS.filter(([, pattern]) => [...baseSegments, ...traitedSegments, ...descriptionSegments]
    .some(segment => pattern.test(segment))).map(([type]) => type);
  const baseTypes = HARD_CONTROL_PATTERNS.filter(([, pattern]) => baseSegments.some(segment => pattern.test(segment))).map(([type]) => type);
  const source = baseTypes.length ? 'api-facts' as const
    : traitedSegments.some(segment => HARD_CONTROL_PATTERNS.some(([, pattern]) => pattern.test(segment))) ? 'api-traited-facts' as const
      : types.length ? 'api-description' as const : 'unclassified' as const;
  const conditional = source === 'api-traited-facts'
    || [...baseSegments, ...traitedSegments, ...descriptionSegments].some(segment => /\b(?:if|when|while)\b/.test(segment));
  return { types: [...new Set(types)], source, conditional };
}

function descriptionSentences(skill: Gw2Skill) {
  return (skill.description ?? '').toLowerCase().split(/[.!?\n]+/).map(sentence => sentence.trim()).filter(Boolean);
}

function stabilityDurationMs(skill: Gw2Skill) {
  const durations = (skill.facts ?? []).filter(fact => fact.type === 'Buff' && normalize(fact.status ?? '') === 'stability')
    .map(fact => finite(fact.duration) * 1000).filter(value => value > 0);
  return durations.length ? Math.max(...durations) : PRESSURE_WINDOW_MS;
}

function aegisDurationMs(skill: Gw2Skill) {
  const durations = (skill.facts ?? []).filter(fact => fact.type === 'Buff' && normalize(fact.status ?? '') === 'aegis')
    .map(fact => finite(fact.duration) * 1000).filter(value => value > 0);
  return durations.length ? Math.max(...durations) : PRESSURE_WINDOW_MS;
}

function resistanceDurationMs(skill: Gw2Skill) {
  const durations = (skill.facts ?? []).filter(fact => fact.type === 'Buff' && normalize(fact.status ?? '') === 'resistance')
    .map(fact => finite(fact.duration) * 1000).filter(value => value > 0);
  return durations.length ? Math.max(...durations) : PRESSURE_WINDOW_MS;
}

export function grantsStability(skill: Gw2Skill) {
  const hasStability = (skill.facts ?? []).some(fact => fact.type === 'Buff' && normalize(fact.status ?? '') === 'stability');
  return hasStability && descriptionSentences(skill).some(sentence => /\bstabil(?:ity|ities|ize[ds]?|izing)\b/.test(sentence) && ALLIED_TARGET.test(sentence));
}

export function grantsAegis(skill: Gw2Skill) {
  const hasAegis = (skill.facts ?? []).some(fact => fact.type === 'Buff' && normalize(fact.status ?? '') === 'aegis');
  return hasAegis && descriptionSentences(skill).some(sentence => /\baegis\b/.test(sentence) && ALLIED_TARGET.test(sentence));
}

export function grantsResistance(skill: Gw2Skill) {
  const hasResistance = (skill.facts ?? []).some(fact => fact.type === 'Buff' && normalize(fact.status ?? '') === 'resistance');
  return hasResistance && descriptionSentences(skill).some(sentence => /\bresistance\b/.test(sentence) && ALLIED_TARGET.test(sentence));
}

export function breaksAlliedStun(skill: Gw2Skill) {
  const known = RESPONSE_RULES.some(rule => rule.kind === 'stunbreak' && !rule.preventionOnly
    && (rule.skillId === skill.id || [rule.name, ...(rule.aliases ?? [])].some(name => normalize(name) === normalize(skill.name))));
  if (known) return true;
  return descriptionSentences(skill).some(sentence => {
    if (!/breaks?(?:\s+out\s+of)?\s+stuns?/.test(sentence) || !ALLIED_TARGET.test(sentence)) return false;
    return !/breaks?(?:\s+out\s+of)?\s+stuns?(?:\s+on)?\s+(?:yourself|self)\b/.test(sentence);
  });
}

interface EffectTransition {
  account: string;
  timeMs: number;
  before: number | null;
  after: number;
}

function effectTransitions(report: WvWReport, fightId: string, effectName: string) {
  const replay = report.stats.replayFights?.find(fight => fight.fightId === fightId);
  const gains: EffectTransition[] = [];
  const losses: EffectTransition[] = [];
  let trackedPlayers = 0;
  const statesByAccount = new Map<string, Array<[number, number]>>();
  const roster = replay?.data.players.filter(player => player.inSquad === true) ?? [];
  for (const player of roster) {
    const tracks = player.effects.filter(effect => effect.classification === 'Boon' && normalize(effect.name) === normalize(effectName));
    if (tracks.length !== 1) continue;
    const states = tracks[0].states.filter(([time, value]) => Number.isFinite(time) && time >= 0 && Number.isFinite(value) && value >= 0)
      .slice().sort((a, b) => a[0] - b[0]);
    if (!states.length) continue;
    trackedPlayers += 1;
    statesByAccount.set(player.account, states);
    let previous: number | null = null;
    for (const [timeMs, value] of states) {
      const event = { account: player.account, timeMs, before: previous, after: value };
      if (value > (previous ?? 0)) gains.push(event);
      if (previous !== null && value < previous) losses.push(event);
      previous = value;
    }
  }
  return { gains, losses, statesByAccount, trackedPlayers, rosterPlayers: roster.length };
}

const stabilityTransitions = (report: WvWReport, fightId: string) => effectTransitions(report, fightId, 'Stability');
const aegisTransitions = (report: WvWReport, fightId: string) => effectTransitions(report, fightId, 'Aegis');
const resistanceTransitions = (report: WvWReport, fightId: string) => effectTransitions(report, fightId, 'Resistance');

function controlEvents(report: WvWReport, fightId: string) {
  const fight = report.stats.mechanics?.fights.find(entry => entry.fightId === fightId);
  return (fight?.mechanics ?? []).flatMap(mechanic => mechanic.events.map(event => ({
    timeMs: event.time,
    account: event.account,
    actor: event.actor,
    label: mechanic.def.fullName || mechanic.def.name,
  }))).filter(event => Number.isFinite(event.timeMs) && event.timeMs >= 0
    && responseKind({ time: event.timeMs, account: event.account, kind: 'mechanic', label: event.label }) === 'stunbreak')
    .sort((a, b) => a.timeMs - b.timeMs);
}

export type StabilityAttemptOutcome = 'intercepted' | 'controlled' | 'other-defense' | 'unresolved';

export interface IncomingControlAttempt {
  key: string;
  timeMs: number;
  sourceName: string;
  sourceAccount?: string;
  targetName: string;
  targetAccount: string;
  targetGroup: number;
  skillId: number;
  skillName: string;
  icon?: string;
  controlTypes: HardControlType[];
  conditional: boolean;
  referenceSource: 'api-facts' | 'api-traited-facts' | 'api-description' | 'mechanic-timeline' | 'boon-transition';
  results: number[];
  stabilityBefore: number | null;
  stabilityLoss: number;
  outcome: StabilityAttemptOutcome;
  providerCastKey?: string;
}

function stateAt(states: Array<[number, number]> | undefined, timeMs: number) {
  if (!states?.length) return null;
  let value: number | null = null;
  for (const [time, next] of states) {
    if (time > timeMs) break;
    value = next;
  }
  return value;
}

const NON_DAMAGING_CONDITIONS = new Map([
  ['blind', 'Blind'], ['blinded', 'Blind'],
  ['chill', 'Chilled'], ['chilled', 'Chilled'],
  ['cripple', 'Crippled'], ['crippled', 'Crippled'],
  ['fear', 'Fear'],
  ['immobile', 'Immobilized'], ['immobilize', 'Immobilized'], ['immobilized', 'Immobilized'],
  ['slow', 'Slow'], ['slowed', 'Slow'],
  ['taunt', 'Taunt'],
  ['weakness', 'Weakness'],
  ['vulnerability', 'Vulnerability'],
]);

function nonDamagingConditionName(value: string) {
  return NON_DAMAGING_CONDITIONS.get(normalize(value));
}

export function conditionReference(skill: Gw2Skill) {
  const baseConditions = (skill.facts ?? []).flatMap(fact => {
    const condition = nonDamagingConditionName(fact.status ?? '');
    return condition ? [condition] : [];
  });
  const traitedConditions = (skill.traited_facts ?? []).flatMap(fact => {
    const condition = nonDamagingConditionName(fact.status ?? '');
    return condition ? [condition] : [];
  });
  if (baseConditions.length) return { conditions: [...new Set(baseConditions)], source: 'api-facts' as const, conditional: false };
  if (traitedConditions.length) return { conditions: [...new Set(traitedConditions)], source: 'api-traited-facts' as const, conditional: true };
  const hostileSentences = descriptionSentences(skill).filter(sentence =>
    /\b(?:inflict|inflicts|apply|applies|cause|causes|blind|cripple|chill|immobilize|fear|taunt|weaken)\b/.test(sentence)
    && /\b(?:foes?|enemies|target)\b/.test(sentence));
  const descriptionConditions = [...NON_DAMAGING_CONDITIONS].flatMap(([alias, condition]) => hostileSentences
    .some(sentence => new RegExp(`\\b${alias}\\b`).test(sentence)) ? [condition] : []);
  return descriptionConditions.length
    ? { conditions: [...new Set(descriptionConditions)], source: 'api-description' as const, conditional: true }
    : { conditions: [], source: 'unclassified' as const, conditional: false };
}

interface ConditionPressureInterval {
  account: string;
  group: number;
  condition: string;
  startMs: number;
  endMs: number;
}

interface ConditionArrival {
  account: string;
  group: number;
  condition: string;
  timeMs: number;
}

export interface ResistanceConditionEffectiveness {
  condition: string;
  affectedPlayers: number;
  conditionPressureMs: number;
  suppressedConditionMs: number;
  effectiveRating: number | null;
  conditionArrivals: number;
  coveredArrivals: number;
  readinessRating: number | null;
  attributedArrivals: number;
  verifiedArrivals: number;
  candidateArrivals: number;
  ambiguousArrivals: number;
  attributionCoverage: number | null;
  sources: ResistanceConditionSource[];
}

export interface ResistanceConditionSource {
  skillId: number;
  skillName: string;
  icon?: string;
  matchedArrivals: number;
  coveredArrivals: number;
  unprotectedArrivals: number;
  averageCertainty: number;
  sourceNames: string[];
  targetAccounts: string[];
  firstTimeMs: number;
  lastTimeMs: number;
  referenceSource: 'api-facts' | 'api-traited-facts' | 'api-description' | 'timing-candidate';
}

interface ConditionArrivalAttribution {
  key: string;
  condition: string;
  account: string;
  timeMs: number;
  resistanceActive: boolean;
  status: 'matched' | 'ambiguous' | 'unattributed';
  certainty: number;
  skillId?: number;
  skillName?: string;
  icon?: string;
  sourceName?: string;
  referenceSource?: ResistanceConditionSource['referenceSource'];
}

function nonDamagingConditionPressure(report: WvWReport, fightId: string, groupsByAccount: Map<string, number>) {
  const replay = report.stats.replayFights?.find(fight => fight.fightId === fightId);
  const durationMs = Math.max(0, finite(replay?.data.durationMs));
  const roster = replay?.data.players.filter(player => player.inSquad === true) ?? [];
  const intervals: ConditionPressureInterval[] = [];
  const arrivals: ConditionArrival[] = [];
  let trackedPlayers = 0;
  for (const player of roster) {
    const tracks = player.effects.flatMap(effect => {
      if (effect.classification !== 'Condition') return [];
      const condition = nonDamagingConditionName(effect.name);
      return condition ? [{ condition, states: effect.states }] : [];
    });
    if (tracks.length) trackedPlayers += 1;
    for (const track of tracks) {
      const states = track.states.filter(([time, value]) => Number.isFinite(time) && time >= 0 && Number.isFinite(value) && value >= 0)
        .slice().sort((a, b) => a[0] - b[0]);
      let previous = 0;
      for (let index = 0; index < states.length; index += 1) {
        const [timeMs, value] = states[index];
        const nextTimeMs = Math.min(durationMs || Infinity, states[index + 1]?.[0] ?? durationMs);
        if (value > previous) arrivals.push({ account: player.account, group: groupsByAccount.get(player.account) ?? 0,
          condition: track.condition, timeMs });
        if (value > 0 && nextTimeMs > timeMs && Number.isFinite(nextTimeMs)) intervals.push({ account: player.account,
          group: groupsByAccount.get(player.account) ?? 0, condition: track.condition, startMs: timeMs, endMs: nextTimeMs });
        previous = value;
      }
    }
  }
  return { intervals, arrivals, trackedPlayers, rosterPlayers: roster.length, durationMs };
}

function activeIntervals(states: Array<[number, number]> | undefined, durationMs: number) {
  if (!states?.length) return [] as Array<{ startMs: number; endMs: number }>;
  const sorted = states.slice().sort((a, b) => a[0] - b[0]);
  return sorted.flatMap(([timeMs, value], index) => {
    const endMs = Math.min(durationMs || Infinity, sorted[index + 1]?.[0] ?? durationMs);
    return value > 0 && endMs > timeMs && Number.isFinite(endMs) ? [{ startMs: timeMs, endMs }] : [];
  });
}

function intervalOverlapMs(startMs: number, endMs: number, intervals: Array<{ startMs: number; endMs: number }>) {
  return intervals.reduce((sum, interval) => sum + Math.max(0, Math.min(endMs, interval.endMs) - Math.max(startMs, interval.startMs)), 0);
}

function mergeIntervals(intervals: Array<{ startMs: number; endMs: number }>) {
  const sorted = intervals.filter(interval => interval.endMs > interval.startMs).slice().sort((a, b) => a.startMs - b.startMs);
  const merged: Array<{ startMs: number; endMs: number }> = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (!previous || interval.startMs > previous.endMs) merged.push({ ...interval });
    else previous.endMs = Math.max(previous.endMs, interval.endMs);
  }
  return merged;
}

function conditionPressureDuration(intervals: ConditionPressureInterval[], windows?: Array<{ startMs: number; endMs: number }>) {
  return intervals.reduce((sum, interval) => sum + (windows
    ? intervalOverlapMs(interval.startMs, interval.endMs, windows)
    : interval.endMs - interval.startMs), 0);
}

function suppressedConditionDuration(
  intervals: ConditionPressureInterval[],
  resistanceByAccount: Map<string, Array<{ startMs: number; endMs: number }>>,
  windows?: Array<{ startMs: number; endMs: number }>,
) {
  return intervals.reduce((sum, interval) => {
    const resistance = resistanceByAccount.get(interval.account) ?? [];
    if (!windows) return sum + intervalOverlapMs(interval.startMs, interval.endMs, resistance);
    const resistedSegments = resistance.flatMap(active => {
      const startMs = Math.max(interval.startMs, active.startMs);
      const endMs = Math.min(interval.endMs, active.endMs);
      return endMs > startMs ? [{ startMs, endMs }] : [];
    });
    return sum + resistedSegments.reduce((total, segment) => total + intervalOverlapMs(segment.startMs, segment.endMs, windows), 0);
  }, 0);
}

const conditionArrivalKey = (arrival: Pick<ConditionArrival, 'account' | 'condition' | 'timeMs'>) =>
  `${arrival.account}:${arrival.condition}:${arrival.timeMs}`;

function conditionSourceCertainty(source: ResistanceConditionSource['referenceSource'], deltaMs: number) {
  if (source === 'timing-candidate') return deltaMs <= 25 ? 60 : deltaMs <= 75 ? 50 : deltaMs <= 150 ? 40 : 30;
  const proximity = deltaMs <= 100 ? 95 : deltaMs <= 250 ? 90 : deltaMs <= 500 ? 80 : 70;
  return Math.max(40, proximity - (source === 'api-facts' ? 0 : source === 'api-traited-facts' ? 10 : 20));
}

function buildConditionArrivalAttributions(
  report: WvWReport,
  fightId: string,
  arrivals: ConditionArrival[],
  references: Map<number, Gw2Skill>,
  resistanceStates: Map<string, Array<[number, number]>>,
) {
  const fight = report.stats.incomingSkillEvents?.fights.find(entry => entry.fightId === fightId);
  const eventIndex = new Map<string, Array<{
    event: NonNullable<typeof fight>['events'][number];
    skill: Gw2Skill;
    source: ResistanceConditionSource['referenceSource'];
  }>>();
  const temporalIndex = new Map<string, Array<{
    event: NonNullable<typeof fight>['events'][number];
    skill?: Gw2Skill;
    source: 'timing-candidate';
  }>>();
  for (const event of fight?.events ?? []) {
    if (event.isBuff || [COMBAT_RESULT.BLOCK, COMBAT_RESULT.EVADE, COMBAT_RESULT.ABSORB, COMBAT_RESULT.BLIND].includes(event.result as 3 | 4 | 6 | 7)) continue;
    const skill = references.get(event.skillId);
    temporalIndex.set(event.targetAccount, [...(temporalIndex.get(event.targetAccount) ?? []), {
      event, skill, source: 'timing-candidate',
    }]);
    if (!skill) continue;
    const reference = conditionReference(skill);
    if (reference.source === 'unclassified') continue;
    for (const condition of reference.conditions) {
      const key = `${event.targetAccount}:${condition}`;
      eventIndex.set(key, [...(eventIndex.get(key) ?? []), { event, skill, source: reference.source }]);
    }
  }
  const attributions = new Map<string, ConditionArrivalAttribution>();
  for (const arrival of arrivals) {
    const resistanceActive = (stateAt(resistanceStates.get(arrival.account), Math.max(0, arrival.timeMs - 1)) ?? 0) > 0;
    const verifiedCandidates = (eventIndex.get(`${arrival.account}:${arrival.condition}`) ?? [])
      .map(candidate => ({ ...candidate, deltaMs: Math.abs(candidate.event.timeMs - arrival.timeMs) }))
      .filter(candidate => candidate.deltaMs <= CONDITION_SOURCE_MATCH_MS)
      .sort((a, b) => a.deltaMs - b.deltaMs || a.skill.id - b.skill.id);
    const candidates = verifiedCandidates.length ? verifiedCandidates : (temporalIndex.get(arrival.account) ?? [])
      .map(candidate => ({ ...candidate, deltaMs: Math.abs(candidate.event.timeMs - arrival.timeMs) }))
      .filter(candidate => candidate.deltaMs <= CONDITION_TEMPORAL_CANDIDATE_MS)
      .sort((a, b) => a.deltaMs - b.deltaMs || a.event.skillId - b.event.skillId);
    const closestBySkill = [...new Map(candidates.map(candidate => [candidate.event.skillId, candidate])).values()]
      .sort((a, b) => a.deltaMs - b.deltaMs || a.event.skillId - b.event.skillId);
    const closest = closestBySkill[0];
    const next = closestBySkill[1];
    const key = conditionArrivalKey(arrival);
    if (!closest) {
      attributions.set(key, { key, condition: arrival.condition, account: arrival.account, timeMs: arrival.timeMs,
        resistanceActive, status: 'unattributed', certainty: 0 });
      continue;
    }
    const ambiguityMs = closest.source === 'timing-candidate' ? CONDITION_TEMPORAL_AMBIGUITY_MS : CONDITION_SOURCE_AMBIGUITY_MS;
    if (next && next.deltaMs - closest.deltaMs <= ambiguityMs) {
      attributions.set(key, { key, condition: arrival.condition, account: arrival.account, timeMs: arrival.timeMs,
        resistanceActive, status: 'ambiguous', certainty: 50 });
      continue;
    }
    attributions.set(key, {
      key,
      condition: arrival.condition,
      account: arrival.account,
      timeMs: arrival.timeMs,
      resistanceActive,
      status: 'matched',
      certainty: conditionSourceCertainty(closest.source, closest.deltaMs),
      skillId: closest.event.skillId,
      skillName: closest.skill?.name ?? closest.event.skillName,
      icon: closest.skill?.icon,
      sourceName: closest.event.sourceName,
      referenceSource: closest.source,
    });
  }
  return attributions;
}

function conditionSources(attributions: ConditionArrivalAttribution[]) {
  const grouped = new Map<number, ResistanceConditionSource & { certaintyTotal: number }>();
  for (const attribution of attributions) {
    if (attribution.status !== 'matched' || !attribution.skillId || !attribution.skillName || !attribution.referenceSource) continue;
    const existing = grouped.get(attribution.skillId) ?? {
      skillId: attribution.skillId,
      skillName: attribution.skillName,
      icon: attribution.icon,
      matchedArrivals: 0,
      coveredArrivals: 0,
      unprotectedArrivals: 0,
      averageCertainty: 0,
      sourceNames: [],
      targetAccounts: [],
      firstTimeMs: attribution.timeMs,
      lastTimeMs: attribution.timeMs,
      referenceSource: attribution.referenceSource,
      certaintyTotal: 0,
    };
    existing.matchedArrivals += 1;
    existing.coveredArrivals += attribution.resistanceActive ? 1 : 0;
    existing.unprotectedArrivals += attribution.resistanceActive ? 0 : 1;
    existing.certaintyTotal += attribution.certainty;
    existing.averageCertainty = existing.certaintyTotal / existing.matchedArrivals;
    existing.sourceNames = [...new Set([...existing.sourceNames, ...(attribution.sourceName ? [attribution.sourceName] : [])])].slice(0, 3);
    existing.targetAccounts = [...new Set([...existing.targetAccounts, attribution.account])].slice(0, 5);
    existing.firstTimeMs = Math.min(existing.firstTimeMs, attribution.timeMs);
    existing.lastTimeMs = Math.max(existing.lastTimeMs, attribution.timeMs);
    grouped.set(attribution.skillId, existing);
  }
  return [...grouped.values()].map(({ certaintyTotal: _, ...source }) => source)
    .sort((a, b) => b.matchedArrivals - a.matchedArrivals
      || b.unprotectedArrivals - a.unprotectedArrivals || b.averageCertainty - a.averageCertainty || a.skillName.localeCompare(b.skillName));
}

function resistanceConditionEffectiveness(
  intervals: ConditionPressureInterval[],
  arrivals: ConditionArrival[],
  resistanceByAccount: Map<string, Array<{ startMs: number; endMs: number }>>,
  resistanceStates: Map<string, Array<[number, number]>>,
  arrivalAttributions: Map<string, ConditionArrivalAttribution>,
  windows?: Array<{ startMs: number; endMs: number }>,
) {
  const inWindows = (timeMs: number) => !windows
    || windows.some(window => timeMs >= window.startMs && timeMs <= window.endMs);
  const scopedIntervals = intervals.filter(interval => !windows
    || intervalOverlapMs(interval.startMs, interval.endMs, windows) > 0);
  const scopedArrivals = arrivals.filter(arrival => inWindows(arrival.timeMs));
  const conditionNames = [...new Set([...scopedIntervals.map(interval => interval.condition), ...scopedArrivals.map(arrival => arrival.condition)])];
  return conditionNames.map(condition => {
    const conditionIntervals = scopedIntervals.filter(interval => interval.condition === condition);
    const conditionArrivals = scopedArrivals.filter(arrival => arrival.condition === condition);
    const conditionPressureMs = conditionPressureDuration(conditionIntervals, windows);
    const suppressedConditionMs = suppressedConditionDuration(conditionIntervals, resistanceByAccount, windows);
    const coveredArrivals = conditionArrivals.filter(arrival =>
      (stateAt(resistanceStates.get(arrival.account), Math.max(0, arrival.timeMs - 1)) ?? 0) > 0).length;
    const affectedPlayers = new Set([
      ...conditionIntervals.map(interval => interval.account),
      ...conditionArrivals.map(arrival => arrival.account),
    ]).size;
    const attributions = conditionArrivals.map(arrival => arrivalAttributions.get(conditionArrivalKey(arrival)))
      .filter((attribution): attribution is ConditionArrivalAttribution => Boolean(attribution));
    const attributedArrivals = attributions.filter(attribution => attribution.status === 'matched').length;
    const verifiedArrivals = attributions.filter(attribution => attribution.status === 'matched'
      && attribution.referenceSource !== 'timing-candidate').length;
    const candidateArrivals = attributedArrivals - verifiedArrivals;
    const ambiguousArrivals = attributions.filter(attribution => attribution.status === 'ambiguous').length;
    return {
      condition,
      affectedPlayers,
      conditionPressureMs,
      suppressedConditionMs,
      effectiveRating: conditionPressureMs > 0 ? suppressedConditionMs / conditionPressureMs : null,
      conditionArrivals: conditionArrivals.length,
      coveredArrivals,
      readinessRating: conditionArrivals.length ? coveredArrivals / conditionArrivals.length : null,
      attributedArrivals,
      verifiedArrivals,
      candidateArrivals,
      ambiguousArrivals,
      attributionCoverage: conditionArrivals.length ? attributedArrivals / conditionArrivals.length : null,
      sources: conditionSources(attributions),
    } satisfies ResistanceConditionEffectiveness;
  }).sort((a, b) => b.conditionPressureMs - a.conditionPressureMs
    || b.conditionArrivals - a.conditionArrivals || a.condition.localeCompare(b.condition));
}

function buildIncomingControlAttempts(
  report: WvWReport,
  fightId: string,
  references: Map<number, Gw2Skill>,
  transitions: ReturnType<typeof stabilityTransitions>,
  groupsByAccount: Map<string, number>,
) {
  const fight = report.stats.incomingSkillEvents?.fights.find(entry => entry.fightId === fightId);
  if (!fight) return { source: 'unavailable' as const, rawEvents: 0, classifiedEvents: 0, attempts: [] as IncomingControlAttempt[] };
  const classified = fight.events.flatMap(event => {
    const skill = references.get(event.skillId);
    if (!skill) return [];
    const control = hardControlReference(skill);
    if (!control.types.length || control.source === 'unclassified') return [];
    return [{ event, skill, control }];
  });
  const buckets = new Map<string, typeof classified>();
  for (const item of classified) {
    const source = item.event.sourceAccount || item.event.sourceName;
    const key = `${source}:${item.event.targetAccount}:${item.event.skillId}`;
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  }
  const clusters: typeof classified[] = [];
  for (const rows of buckets.values()) {
    const sorted = rows.slice().sort((a, b) => a.event.timeMs - b.event.timeMs);
    let cluster: typeof classified = [];
    for (const row of sorted) {
      const previous = cluster.at(-1);
      if (previous && row.event.timeMs - previous.event.timeMs > CONTROL_ATTEMPT_CLUSTER_MS) {
        clusters.push(cluster);
        cluster = [];
      }
      cluster.push(row);
    }
    if (cluster.length) clusters.push(cluster);
  }
  const usedLosses = new Set<EffectTransition>();
  const attempts: IncomingControlAttempt[] = clusters.flatMap((cluster, index) => {
    const first = cluster[0];
    const results = [...new Set(cluster.map(row => row.event.result))];
    if (results.every(result => result === COMBAT_RESULT.SKILL_CAST)) return [];
    const successful = results.includes(COMBAT_RESULT.CROWD_CONTROL);
    const avoided = results.some(result => [COMBAT_RESULT.BLOCK, COMBAT_RESULT.EVADE, COMBAT_RESULT.ABSORB, COMBAT_RESULT.BLIND].includes(result as 3 | 4 | 6 | 7));
    const contacted = results.some(result => [0, 1, 2, 8, 9, COMBAT_RESULT.CROWD_CONTROL].includes(result));
    if (!successful && !avoided && !contacted) return [];
    const timeMs = Math.min(...cluster.map(row => row.event.timeMs));
    const stabilityBefore = stateAt(transitions.statesByAccount.get(first.event.targetAccount), Math.max(0, timeMs - 1));
    const loss = !successful && contacted ? transitions.losses
      .filter(candidate => candidate.account === first.event.targetAccount && !usedLosses.has(candidate)
        && Math.abs(candidate.timeMs - timeMs) <= STABILITY_TRANSITION_MATCH_MS
        && (candidate.before ?? 0) > candidate.after)
      .sort((a, b) => Math.abs(a.timeMs - timeMs) - Math.abs(b.timeMs - timeMs))[0] : undefined;
    if (loss) usedLosses.add(loss);
    const stabilityLoss = loss ? Math.max(0, (loss.before ?? 0) - loss.after) : 0;
    const outcome: StabilityAttemptOutcome = successful ? 'controlled'
      : avoided ? 'other-defense'
        : stabilityBefore !== null && stabilityBefore > 0 && stabilityLoss > 0 ? 'intercepted' : 'unresolved';
    return [{
      key: `${first.event.targetAccount}:${first.event.skillId}:${timeMs}:${index}`,
      timeMs,
      sourceName: first.event.sourceName,
      sourceAccount: first.event.sourceAccount,
      targetName: first.event.targetName,
      targetAccount: first.event.targetAccount,
      targetGroup: groupsByAccount.get(first.event.targetAccount) ?? 0,
      skillId: first.event.skillId,
      skillName: first.skill.name || first.event.skillName,
      icon: first.skill.icon,
      controlTypes: first.control.types,
      conditional: first.control.conditional,
      referenceSource: first.control.source as IncomingControlAttempt['referenceSource'],
      results,
      stabilityBefore,
      stabilityLoss,
      outcome,
    }];
  }).sort((a, b) => a.timeMs - b.timeMs);
  return { source: 'native-evtc' as const, rawEvents: fight.events.length, classifiedEvents: classified.length, attempts };
}

export type AegisAttemptOutcome = 'aegis-block' | 'inferred-consumption' | 'other-block' | 'other-defense' | 'landed' | 'unresolved';

export interface IncomingAttackAttempt {
  key: string;
  timeMs: number;
  sourceName: string;
  sourceAccount?: string;
  targetName: string;
  targetAccount: string;
  targetGroup: number;
  skillId: number;
  skillName: string;
  icon?: string;
  results: number[];
  aegisBefore: number | null;
  aegisLoss: number;
  outcome: AegisAttemptOutcome;
}

function buildIncomingAttackAttempts(
  report: WvWReport,
  fightId: string,
  references: Map<number, Gw2Skill>,
  transitions: ReturnType<typeof aegisTransitions>,
  groupsByAccount: Map<string, number>,
) {
  const fight = report.stats.incomingSkillEvents?.fights.find(entry => entry.fightId === fightId);
  if (!fight) return { source: 'unavailable' as const, rawEvents: 0, attempts: [] as IncomingAttackAttempt[] };
  const direct = fight.events.filter(event => !event.isBuff && event.skillId > 0);
  const buckets = new Map<string, typeof direct>();
  for (const event of direct) {
    const source = event.sourceAccount || event.sourceName;
    const key = `${source}:${event.targetAccount}:${event.skillId}`;
    buckets.set(key, [...(buckets.get(key) ?? []), event]);
  }
  const clusters: typeof direct[] = [];
  for (const rows of buckets.values()) {
    const sorted = rows.slice().sort((a, b) => a.timeMs - b.timeMs);
    let cluster: typeof direct = [];
    for (const row of sorted) {
      const previous = cluster.at(-1);
      if (previous && row.timeMs - previous.timeMs > CONTROL_ATTEMPT_CLUSTER_MS) {
        clusters.push(cluster);
        cluster = [];
      }
      cluster.push(row);
    }
    if (cluster.length) clusters.push(cluster);
  }
  const usedLosses = new Set<EffectTransition>();
  const attempts = clusters.flatMap((cluster, index) => {
    const first = cluster[0];
    const results = [...new Set(cluster.map(event => event.result))];
    if (results.every(result => result === COMBAT_RESULT.SKILL_CAST)) return [];
    const blocked = results.includes(COMBAT_RESULT.BLOCK);
    const avoided = results.some(result => [COMBAT_RESULT.EVADE, COMBAT_RESULT.ABSORB, COMBAT_RESULT.BLIND].includes(result as 4 | 6 | 7));
    const landed = results.some(result => [0, 1, 2, 5, 8, 9, COMBAT_RESULT.CROWD_CONTROL].includes(result));
    if (!blocked && !avoided && !landed) return [];
    const timeMs = Math.min(...cluster.map(event => event.timeMs));
    const aegisBefore = stateAt(transitions.statesByAccount.get(first.targetAccount), Math.max(0, timeMs - 1));
    const loss = blocked && (aegisBefore ?? 0) > 0 ? transitions.losses
      .filter(candidate => candidate.account === first.targetAccount && !usedLosses.has(candidate)
        && Math.abs(candidate.timeMs - timeMs) <= STABILITY_TRANSITION_MATCH_MS
        && (candidate.before ?? 0) > 0 && candidate.after === 0)
      .sort((a, b) => Math.abs(a.timeMs - timeMs) - Math.abs(b.timeMs - timeMs))[0] : undefined;
    if (loss) usedLosses.add(loss);
    const outcome: AegisAttemptOutcome = blocked && loss ? 'aegis-block'
      : blocked ? 'other-block'
        : avoided ? 'other-defense'
          : landed ? 'landed' : 'unresolved';
    const reference = references.get(first.skillId);
    return [{
      key: `${first.targetAccount}:${first.skillId}:${timeMs}:${index}`,
      timeMs,
      sourceName: first.sourceName,
      sourceAccount: first.sourceAccount,
      targetName: first.targetName,
      targetAccount: first.targetAccount,
      targetGroup: groupsByAccount.get(first.targetAccount) ?? 0,
      skillId: first.skillId,
      skillName: reference?.name || first.skillName,
      icon: reference?.icon,
      results,
      aegisBefore,
      aegisLoss: loss ? Math.max(0, (loss.before ?? 0) - loss.after) : 0,
      outcome,
    }];
  }).sort((a, b) => a.timeMs - b.timeMs);
  return { source: 'native-evtc' as const, rawEvents: direct.length, attempts };
}

interface StabilityCast {
  key: string;
  account: string;
  group: number;
  profession: string;
  skillId: number;
  skillName: string;
  icon?: string;
  timeMs: number;
  durationMs: number;
  pressureEndMs: number;
}

interface AegisCast extends StabilityCast {}

function inferredStabilityAttempts(
  transitions: ReturnType<typeof stabilityTransitions>,
  controls: UtilityControlEvent[],
  casts: StabilityCast[],
  groupsByAccount: Map<string, number>,
) {
  const attempts: IncomingControlAttempt[] = controls.filter(control => Boolean(control.account)).map((control, index) => ({
    key: `mechanic:${control.account}:${control.timeMs}:${index}`,
    timeMs: control.timeMs,
    sourceName: 'Mechanic timeline',
    targetName: control.actor,
    targetAccount: control.account!,
    targetGroup: groupsByAccount.get(control.account!) ?? 0,
    skillId: 0,
    skillName: control.label,
    controlTypes: [],
    conditional: false,
    referenceSource: 'mechanic-timeline',
    results: [COMBAT_RESULT.CROWD_CONTROL],
    stabilityBefore: stateAt(transitions.statesByAccount.get(control.account!), Math.max(0, control.timeMs - 1)),
    stabilityLoss: 0,
    outcome: 'controlled',
  }));
  const tokens = transitions.gains.flatMap(gain => {
    const targetGroup = groupsByAccount.get(gain.account) ?? 0;
    const candidates = casts.filter(cast => cast.group === targetGroup
      && gain.timeMs >= cast.timeMs - STABILITY_TRANSITION_MATCH_MS
      && gain.timeMs <= cast.timeMs + cast.durationMs + 1_000);
    const matched = uniquelyClosest(gain, candidates, cast => gain.timeMs - (cast.timeMs + cast.durationMs));
    if (!matched) return [];
    const units = Math.max(0, Math.floor(gain.after - (gain.before ?? 0)));
    return Array.from({ length: units }, (_, unit) => ({
      key: `${gain.account}:${gain.timeMs}:${matched.key}:${unit}`,
      account: gain.account,
      targetGroup,
      gainTimeMs: gain.timeMs,
      expectedExpiryMs: matched.pressureEndMs,
      providerCastKey: matched.key,
      consumed: false,
    }));
  });
  let ambiguousLossUnits = 0;
  for (const loss of transitions.losses.slice().sort((a, b) => a.timeMs - b.timeMs)) {
    const units = Math.max(0, Math.floor((loss.before ?? 0) - loss.after));
    if (!units) continue;
    const targetGroup = groupsByAccount.get(loss.account) ?? 0;
    const landedNearby = controls.some(control => control.account === loss.account
      && Math.abs(control.timeMs - loss.timeMs) <= CONTROL_PROXIMITY_MS);
    for (let unit = 0; unit < units; unit += 1) {
      const active = tokens.filter(token => token.account === loss.account && !token.consumed
        && token.gainTimeMs <= loss.timeMs
        && loss.timeMs <= token.expectedExpiryMs + STABILITY_TRANSITION_MATCH_MS)
        .sort((a, b) => a.expectedExpiryMs - b.expectedExpiryMs);
      if (!active.length) continue;
      const expiring = active.slice().sort((a, b) => Math.abs(a.expectedExpiryMs - loss.timeMs) - Math.abs(b.expectedExpiryMs - loss.timeMs))[0];
      if (Math.abs(expiring.expectedExpiryMs - loss.timeMs) <= STABILITY_TRANSITION_MATCH_MS) {
        expiring.consumed = true;
        continue;
      }
      const consumed = active[0];
      consumed.consumed = true;
      if (landedNearby) continue;
      const providerKeys = new Set(active.map(token => token.providerCastKey));
      const providerCastKey = providerKeys.size === 1 ? consumed.providerCastKey : undefined;
      if (!providerCastKey) ambiguousLossUnits += 1;
      attempts.push({
        key: `stability-consumption:${loss.account}:${loss.timeMs}:${unit}`,
        timeMs: loss.timeMs,
        sourceName: 'Boon timeline',
        targetName: loss.account,
        targetAccount: loss.account,
        targetGroup,
        skillId: 0,
        skillName: 'Stability stack consumed early',
        controlTypes: [],
        conditional: true,
        referenceSource: 'boon-transition',
        results: [],
        stabilityBefore: loss.before,
        stabilityLoss: 1,
        outcome: 'intercepted',
        providerCastKey,
      });
    }
  }
  return {
    source: attempts.length || transitions.trackedPlayers ? 'mechanic-boon-inference' as const : 'unavailable' as const,
    rawEvents: controls.length + transitions.losses.length,
    classifiedEvents: controls.length,
    attempts: attempts.sort((a, b) => a.timeMs - b.timeMs),
    ambiguousLossUnits,
  };
}

function inferredAegisAttempts(
  transitions: ReturnType<typeof aegisTransitions>,
  casts: AegisCast[],
  groupsByAccount: Map<string, number>,
) {
  const attempts: IncomingAttackAttempt[] = [];
  let ambiguousConsumptions = 0;
  for (const loss of transitions.losses) {
    if ((loss.before ?? 0) <= 0 || loss.after !== 0) continue;
    const targetGroup = groupsByAccount.get(loss.account) ?? 0;
    const candidates = casts.filter(cast => cast.group === targetGroup
      && loss.timeMs >= cast.timeMs
      && loss.timeMs < cast.pressureEndMs - STABILITY_TRANSITION_MATCH_MS);
    if (candidates.length > 1) ambiguousConsumptions += 1;
    if (candidates.length !== 1) continue;
    attempts.push({
      key: `aegis-consumption:${loss.account}:${loss.timeMs}`,
      timeMs: loss.timeMs,
      sourceName: 'Boon timeline',
      targetName: loss.account,
      targetAccount: loss.account,
      targetGroup,
      skillId: 0,
      skillName: 'Aegis consumed before expiry',
      results: [],
      aegisBefore: loss.before,
      aegisLoss: Math.max(0, (loss.before ?? 0) - loss.after),
      outcome: 'inferred-consumption',
    });
  }
  return {
    source: transitions.trackedPlayers && casts.length ? 'boon-transition-inference' as const : 'unavailable' as const,
    rawEvents: transitions.losses.length,
    attempts: attempts.sort((a, b) => a.timeMs - b.timeMs),
    ambiguousConsumptions,
  };
}

export interface UtilityControlEvent {
  timeMs: number;
  account?: string;
  actor: string;
  label: string;
}

export interface StabilityApplication {
  key: string;
  skillId: number;
  skillName: string;
  icon?: string;
  timeMs: number;
  endMs: number;
  pressureEvents: UtilityControlEvent[];
  controlAttempts: IncomingControlAttempt[];
  realizedInterceptions: number;
  inferredInterceptions: number;
  correlatedRecipientGains: number;
  candidateNegatedControls: number;
}

export interface AegisApplication {
  key: string;
  skillId: number;
  skillName: string;
  icon?: string;
  timeMs: number;
  endMs: number;
  attackAttempts: IncomingAttackAttempt[];
  confirmedBlocks: number;
  inferredConsumptions: number;
  correlatedRecipientGains: number;
}

export interface ResistanceApplication {
  key: string;
  skillId: number;
  skillName: string;
  icon?: string;
  timeMs: number;
  endMs: number;
  conditionNames: string[];
  conditionPressureMs: number;
  suppressedConditionMs: number;
  conditionArrivals: number;
  coveredArrivals: number;
  correlatedRecipientGains: number;
  conditions: ResistanceConditionEffectiveness[];
}

export interface StunbreakResponseEvent {
  key: string;
  eventTimeMs: number;
  targetAccount?: string;
  targetActor: string;
  label: string;
  castTimeMs: number;
  delayMs: number;
  skillId: number;
  skillName: string;
  icon?: string;
}

function uniquelyClosest<T extends { timeMs: number }>(event: EffectTransition, candidates: T[], distance: (candidate: T) => number) {
  const sorted = candidates.map(candidate => ({ candidate, distance: Math.abs(distance(candidate)) }))
    .sort((a, b) => a.distance - b.distance);
  if (!sorted.length || (sorted[1] && Math.abs(sorted[1].distance - sorted[0].distance) <= 250)) return null;
  return sorted[0].candidate;
}

function alliedGeneration(report: WvWReport, account: string, boon = 'Stability') {
  const table = report.stats.buffGeneration?.find(entry => normalize(entry.name) === normalize(boon));
  const row = table?.rows.find(entry => entry.account === account);
  if (!row) return { generatedStackSeconds: null, wastedStackSeconds: null, generationEfficiency: null };
  const categories = [row.categories.groupBuffs, row.categories.squadBuffs];
  const generated = categories.reduce((sum, category) => sum + finite(category.generationMs), 0) / 1000;
  const wasted = categories.reduce((sum, category) => sum + finite(category.wastedMs), 0) / 1000;
  return { generatedStackSeconds: generated, wastedStackSeconds: wasted,
    generationEfficiency: generated + wasted > 0 ? generated / (generated + wasted) : null };
}

export interface StabilityEffectivenessRow {
  account: string;
  group: number;
  profession: string;
  skills: Array<{ id: number; name: string; icon?: string; casts: number }>;
  casts: number;
  pressureAlignedCasts: number;
  pressureTimingRating: number | null;
  pressureCoveredControls: number;
  pressureCoverageRating: number | null;
  threatAttempts: number;
  protectedAttempts: number;
  readinessRating: number | null;
  resolvedControlContests: number;
  realizedInterceptions: number;
  inferredInterceptions: number;
  realizedEffectiveness: number | null;
  successfulControls: number;
  unresolvedAttempts: number;
  correlatedRecipientGains: number;
  candidateNegatedControls: number;
  generatedStackSeconds: number | null;
  wastedStackSeconds: number | null;
  generationEfficiency: number | null;
  applications: StabilityApplication[];
}

export interface AegisEffectivenessRow {
  account: string;
  group: number;
  profession: string;
  skills: Array<{ id: number; name: string; icon?: string; casts: number }>;
  casts: number;
  realizedCasts: number;
  castConversion: number | null;
  confirmedBlocks: number;
  inferredConsumptions: number;
  threatAttempts: number;
  readyAttempts: number;
  readinessRating: number | null;
  otherBlocks: number;
  otherDefenses: number;
  landedWhileAegisPresent: number;
  correlatedRecipientGains: number;
  generatedSeconds: number | null;
  wastedSeconds: number | null;
  generationEfficiency: number | null;
  applications: AegisApplication[];
}

export interface ResistanceEffectivenessRow {
  account: string;
  group: number;
  profession: string;
  skills: Array<{ id: number; name: string; icon?: string; casts: number }>;
  casts: number;
  pressureAlignedCasts: number;
  conditionPressureMs: number;
  suppressedConditionMs: number;
  effectiveRating: number | null;
  conditionArrivals: number;
  coveredArrivals: number;
  readinessRating: number | null;
  correlatedRecipientGains: number;
  generatedSeconds: number | null;
  wastedSeconds: number | null;
  generationEfficiency: number | null;
  applications: ResistanceApplication[];
  conditions: ResistanceConditionEffectiveness[];
}

export interface StunbreakEffectivenessRow {
  account: string;
  group: number;
  profession: string;
  skills: Array<{ id: number; name: string; icon?: string; casts: number }>;
  confirmedBreaks: number;
  removedControlSeconds: number;
  averagePreventedSeconds: number | null;
  correlatedResponses: number;
  averageCorrelatedDelayMs: number | null;
  responseShare: number | null;
  responseEvents: StunbreakResponseEvent[];
}

export interface UtilityEffectivenessScope {
  key: string;
  group: number | null;
  label: string;
  memberCount: number;
  stability: {
    providerAccounts: string[];
    effectiveRating: number | null;
    coveredControls: number;
    eligibleControls: number;
    casts: number;
    alignedCasts: number;
    candidateNegatedControls: number;
    generationEfficiency: number | null;
    threatAttempts: number;
    protectedAttempts: number;
    readinessRating: number | null;
    successfulControls: number;
    otherDefenses: number;
    unresolvedAttempts: number;
    evidenceCoverage: number | null;
  };
  resistance: {
    providerAccounts: string[];
    effectiveRating: number | null;
    conditionPressureMs: number;
    suppressedConditionMs: number;
    conditionArrivals: number;
    coveredArrivals: number;
    readinessRating: number | null;
    casts: number;
    alignedCasts: number;
    conditionTrackedPlayers: number;
    resistanceTrackedPlayers: number;
    conditions: ResistanceConditionEffectiveness[];
  };
  aegis: {
    providerAccounts: string[];
    castConversion: number | null;
    casts: number;
    realizedCasts: number;
    confirmedBlocks: number;
    inferredConsumptions: number;
    threatAttempts: number;
    readyAttempts: number;
    readinessRating: number | null;
    otherBlocks: number;
    otherDefenses: number;
    landedWhileAegisPresent: number;
    evidenceCoverage: number | null;
  };
  stunbreak: {
    providerAccounts: string[];
    effectiveRating: number | null;
    matchedResponses: number;
    eligibleControls: number;
    confirmedBreaks: number;
    removedControlSeconds: number;
    averagePreventedSeconds: number | null;
    averageCorrelatedDelayMs: number | null;
  };
}

const normalizedGroup = (value: unknown) => {
  const group = Number(value);
  return Number.isFinite(group) && group > 0 ? group : 0;
};

const groupSortValue = (group: number) => group > 0 ? group : Number.MAX_SAFE_INTEGER;

function accountGroups(report: WvWReport) {
  const groups = new Map<string, number>();
  for (const row of report.stats.attendanceData ?? []) groups.set(row.account, normalizedGroup(row.group));
  for (const row of report.stats.boonUptimes?.rows ?? []) {
    if (!groups.has(row.account)) groups.set(row.account, normalizedGroup(row.group));
  }
  return groups;
}

export function buildUtilityEffectiveness(report: WvWReport, fightId: string, apiSkills: Gw2Skill[]) {
  const rotation = report.stats.rotations?.fights.find(fight => fight.fightId === fightId);
  const groupsByAccount = accountGroups(report);
  const references = new Map<number, Gw2Skill>();
  for (const skill of [...apiSkills, ...firebrandTomeSkills()]) references.set(skill.id, skill);
  const controls = controlEvents(report, fightId);
  const transitions = stabilityTransitions(report, fightId);
  const resistanceState = resistanceTransitions(report, fightId);
  const aegisState = aegisTransitions(report, fightId);
  const conditionPressure = nonDamagingConditionPressure(report, fightId, groupsByAccount);
  const resistanceByAccount = new Map([...resistanceState.statesByAccount].map(([account, states]) => [
    account,
    activeIntervals(states, conditionPressure.durationMs),
  ]));
  const conditionArrivalAttributions = buildConditionArrivalAttributions(report, fightId, conditionPressure.arrivals,
    references, resistanceState.statesByAccount);
  const stabilityCasts: StabilityCast[] = [];
  const resistanceCasts: StabilityCast[] = [];
  const aegisCasts: AegisCast[] = [];
  const stunbreakCasts: Array<StabilityCast> = [];

  for (const player of rotation?.players ?? []) for (const cast of player.casts) {
    const skill = references.get(cast.skillId);
    if (!skill || !Number.isFinite(cast.castTime) || cast.castTime < 0) continue;
    const base = { key: `${player.account}:${cast.skillId}:${cast.castTime}`, account: player.account,
      group: groupsByAccount.get(player.account) ?? 0, profession: player.profession,
      skillId: cast.skillId, skillName: skill.name, icon: skill.icon, timeMs: cast.castTime,
      durationMs: Math.max(0, finite(cast.duration)), pressureEndMs: cast.castTime + stabilityDurationMs(skill) };
    if (grantsStability(skill)) stabilityCasts.push(base);
    if (grantsResistance(skill)) resistanceCasts.push({ ...base, pressureEndMs: cast.castTime + resistanceDurationMs(skill) });
    if (grantsAegis(skill)) aegisCasts.push({ ...base, pressureEndMs: cast.castTime + aegisDurationMs(skill) });
    if (breaksAlliedStun(skill)) stunbreakCasts.push({ ...base, pressureEndMs: cast.castTime + RESPONSE_WINDOW_MS });
  }
  const nativeIncoming = buildIncomingControlAttempts(report, fightId, references, transitions, groupsByAccount);
  const inferredIncoming = inferredStabilityAttempts(transitions, controls, stabilityCasts, groupsByAccount);
  const incoming = nativeIncoming.source === 'native-evtc' ? nativeIncoming : inferredIncoming;
  const nativeIncomingAttacks = buildIncomingAttackAttempts(report, fightId, references, aegisState, groupsByAccount);
  const inferredIncomingAttacks = inferredAegisAttempts(aegisState, aegisCasts, groupsByAccount);
  const incomingAttacks = nativeIncomingAttacks.source === 'native-evtc' ? nativeIncomingAttacks : inferredIncomingAttacks;

  const gainsByCast = new Map<string, EffectTransition[]>();
  let ambiguousGains = 0;
  for (const gain of transitions.gains) {
    const candidates = stabilityCasts.filter(cast => gain.timeMs >= cast.timeMs - 250 && gain.timeMs <= cast.timeMs + cast.durationMs + 1_000);
    const matched = uniquelyClosest(gain, candidates, cast => gain.timeMs - (cast.timeMs + cast.durationMs));
    if (matched) gainsByCast.set(matched.key, [...(gainsByCast.get(matched.key) ?? []), gain]);
    else if (candidates.length > 1) ambiguousGains += 1;
  }

  const lossesByCast = new Map<string, number>();
  let ambiguousStabilityLossUnits = incoming.source === 'mechanic-boon-inference' ? incoming.ambiguousLossUnits : 0;
  for (const attempt of incoming.attempts.filter(event => event.outcome === 'intercepted')) {
    if (incoming.source === 'mechanic-boon-inference') {
      if (attempt.providerCastKey) lossesByCast.set(attempt.providerCastKey, (lossesByCast.get(attempt.providerCastKey) ?? 0) + 1);
      continue;
    }
    const candidates = stabilityCasts.filter(cast => cast.group === attempt.targetGroup
      && attempt.timeMs >= cast.timeMs && attempt.timeMs <= cast.pressureEndMs);
    if (candidates.length > 1) ambiguousStabilityLossUnits += 1;
    if (candidates.length === 1) lossesByCast.set(candidates[0].key, (lossesByCast.get(candidates[0].key) ?? 0) + 1);
  }

  const stabilityAccounts = new Map<string, StabilityCast[]>();
  for (const cast of stabilityCasts) stabilityAccounts.set(cast.account, [...(stabilityAccounts.get(cast.account) ?? []), cast]);
  const stability: StabilityEffectivenessRow[] = [...stabilityAccounts].map(([account, casts]) => {
    const group = casts[0].group;
    const groupAttempts = incoming.attempts.filter(attempt => attempt.targetGroup === group);
    const providerAttempts = groupAttempts.filter(attempt => incoming.source === 'native-evtc'
      ? casts.some(cast => attempt.timeMs >= cast.timeMs && attempt.timeMs <= cast.pressureEndMs)
      : attempt.outcome === 'controlled'
        ? casts.some(cast => attempt.timeMs >= cast.timeMs && attempt.timeMs <= cast.pressureEndMs)
        : Boolean(attempt.providerCastKey && casts.some(cast => cast.key === attempt.providerCastKey)));
    const pressureTimes = incoming.source === 'native-evtc' ? groupAttempts.map(attempt => attempt.timeMs) : controls
      .filter(control => (groupsByAccount.get(control.account ?? '') ?? 0) === group).map(control => control.timeMs);
    const pressureAlignedCasts = casts.filter(cast => pressureTimes.some(timeMs => timeMs >= cast.timeMs && timeMs <= cast.pressureEndMs)).length;
    const protectedAttempts = providerAttempts.filter(attempt => (attempt.stabilityBefore ?? 0) > 0).length;
    const resolvedControlContests = providerAttempts.filter(attempt => attempt.outcome === 'intercepted' || attempt.outcome === 'controlled').length;
    const attributedInterceptions = casts.reduce((sum, cast) => sum + (lossesByCast.get(cast.key) ?? 0), 0);
    const realizedInterceptions = incoming.source === 'native-evtc' ? attributedInterceptions : 0;
    const inferredInterceptions = incoming.source === 'mechanic-boon-inference' ? attributedInterceptions : 0;
    const pressureCoveredControls = protectedAttempts;
    const skills = [...new Map(casts.map(cast => [cast.skillId, cast])).values()].map(skill => ({ id: skill.skillId, name: skill.skillName, icon: skill.icon,
      casts: casts.filter(cast => cast.skillId === skill.skillId).length }));
    const generation = alliedGeneration(report, account);
    const applications = casts.slice().sort((a, b) => a.timeMs - b.timeMs).map(cast => ({
      key: cast.key,
      skillId: cast.skillId,
      skillName: cast.skillName,
      icon: cast.icon,
      timeMs: cast.timeMs,
      endMs: cast.pressureEndMs,
      pressureEvents: controls.filter(control => control.timeMs >= cast.timeMs && control.timeMs <= cast.pressureEndMs),
      controlAttempts: groupAttempts.filter(attempt => incoming.source === 'native-evtc'
        ? attempt.timeMs >= cast.timeMs && attempt.timeMs <= cast.pressureEndMs
        : attempt.outcome === 'controlled'
          ? attempt.timeMs >= cast.timeMs && attempt.timeMs <= cast.pressureEndMs
          : attempt.providerCastKey === cast.key),
      realizedInterceptions: incoming.source === 'native-evtc' ? lossesByCast.get(cast.key) ?? 0 : 0,
      inferredInterceptions: incoming.source === 'mechanic-boon-inference' ? lossesByCast.get(cast.key) ?? 0 : 0,
      correlatedRecipientGains: gainsByCast.get(cast.key)?.length ?? 0,
      candidateNegatedControls: lossesByCast.get(cast.key) ?? 0,
    }));
    return { account, group: casts[0].group, profession: casts[0].profession, skills, casts: casts.length, pressureAlignedCasts,
      pressureTimingRating: pressureTimes.length ? pressureAlignedCasts / casts.length : null,
      pressureCoveredControls, pressureCoverageRating: providerAttempts.length ? protectedAttempts / providerAttempts.length : null,
      threatAttempts: providerAttempts.length, protectedAttempts, readinessRating: providerAttempts.length ? protectedAttempts / providerAttempts.length : null,
      resolvedControlContests, realizedInterceptions, inferredInterceptions,
      realizedEffectiveness: resolvedControlContests ? attributedInterceptions / resolvedControlContests : null,
      successfulControls: providerAttempts.filter(attempt => attempt.outcome === 'controlled').length,
      unresolvedAttempts: providerAttempts.filter(attempt => attempt.outcome === 'unresolved').length,
      correlatedRecipientGains: casts.reduce((sum, cast) => sum + (gainsByCast.get(cast.key)?.length ?? 0), 0),
      candidateNegatedControls: attributedInterceptions, applications, ...generation };
  }).sort((a, b) => groupSortValue(a.group) - groupSortValue(b.group)
    || (b.realizedEffectiveness ?? -1) - (a.realizedEffectiveness ?? -1)
    || b.candidateNegatedControls - a.candidateNegatedControls || a.account.localeCompare(b.account));

  const resistanceGainsByCast = new Map<string, EffectTransition[]>();
  for (const gain of resistanceState.gains) {
    const candidates = resistanceCasts.filter(cast => cast.group === (groupsByAccount.get(gain.account) ?? 0)
      && gain.timeMs >= cast.timeMs - 250 && gain.timeMs <= cast.timeMs + cast.durationMs + 1_000);
    const matched = uniquelyClosest(gain, candidates, cast => gain.timeMs - (cast.timeMs + cast.durationMs));
    if (matched) resistanceGainsByCast.set(matched.key, [...(resistanceGainsByCast.get(matched.key) ?? []), gain]);
  }
  const resistanceAccounts = new Map<string, StabilityCast[]>();
  for (const cast of resistanceCasts) resistanceAccounts.set(cast.account, [...(resistanceAccounts.get(cast.account) ?? []), cast]);
  const resistance: ResistanceEffectivenessRow[] = [...resistanceAccounts].map(([account, casts]) => {
    const group = casts[0].group;
    const groupIntervals = conditionPressure.intervals.filter(interval => interval.group === group);
    const groupArrivals = conditionPressure.arrivals.filter(arrival => arrival.group === group);
    const providerWindows = mergeIntervals(casts.map(cast => ({ startMs: cast.timeMs, endMs: cast.pressureEndMs })));
    const conditionPressureMs = conditionPressureDuration(groupIntervals, providerWindows);
    const suppressedConditionMs = suppressedConditionDuration(groupIntervals, resistanceByAccount, providerWindows);
    const providerArrivals = groupArrivals.filter(arrival => providerWindows.some(window => arrival.timeMs >= window.startMs && arrival.timeMs <= window.endMs));
    const coveredArrivals = providerArrivals.filter(arrival => (stateAt(resistanceState.statesByAccount.get(arrival.account), Math.max(0, arrival.timeMs - 1)) ?? 0) > 0).length;
    const conditions = resistanceConditionEffectiveness(groupIntervals, groupArrivals, resistanceByAccount,
      resistanceState.statesByAccount, conditionArrivalAttributions, providerWindows);
    const applications: ResistanceApplication[] = casts.slice().sort((a, b) => a.timeMs - b.timeMs).map(cast => {
      const window = [{ startMs: cast.timeMs, endMs: cast.pressureEndMs }];
      const pressureIntervals = groupIntervals.filter(interval => interval.endMs > cast.timeMs && interval.startMs < cast.pressureEndMs);
      const arrivals = groupArrivals.filter(arrival => arrival.timeMs >= cast.timeMs && arrival.timeMs <= cast.pressureEndMs);
      const applicationConditions = resistanceConditionEffectiveness(pressureIntervals, arrivals, resistanceByAccount,
        resistanceState.statesByAccount, conditionArrivalAttributions, window);
      return {
        key: cast.key,
        skillId: cast.skillId,
        skillName: cast.skillName,
        icon: cast.icon,
        timeMs: cast.timeMs,
        endMs: cast.pressureEndMs,
        conditionNames: [...new Set(pressureIntervals.map(interval => interval.condition))].sort((a, b) => a.localeCompare(b)),
        conditionPressureMs: conditionPressureDuration(pressureIntervals, window),
        suppressedConditionMs: suppressedConditionDuration(pressureIntervals, resistanceByAccount, window),
        conditionArrivals: arrivals.length,
        coveredArrivals: arrivals.filter(arrival => (stateAt(resistanceState.statesByAccount.get(arrival.account), Math.max(0, arrival.timeMs - 1)) ?? 0) > 0).length,
        correlatedRecipientGains: resistanceGainsByCast.get(cast.key)?.length ?? 0,
        conditions: applicationConditions,
      };
    });
    const skills = [...new Map(casts.map(cast => [cast.skillId, cast])).values()].map(skill => ({
      id: skill.skillId,
      name: skill.skillName,
      icon: skill.icon,
      casts: casts.filter(cast => cast.skillId === skill.skillId).length,
    }));
    const generation = alliedGeneration(report, account, 'Resistance');
    return {
      account,
      group,
      profession: casts[0].profession,
      skills,
      casts: casts.length,
      pressureAlignedCasts: applications.filter(application => application.conditionPressureMs > 0 || application.conditionArrivals > 0).length,
      conditionPressureMs,
      suppressedConditionMs,
      effectiveRating: conditionPressureMs > 0 ? suppressedConditionMs / conditionPressureMs : null,
      conditionArrivals: providerArrivals.length,
      coveredArrivals,
      readinessRating: providerArrivals.length ? coveredArrivals / providerArrivals.length : null,
      correlatedRecipientGains: casts.reduce((sum, cast) => sum + (resistanceGainsByCast.get(cast.key)?.length ?? 0), 0),
      generatedSeconds: generation.generatedStackSeconds,
      wastedSeconds: generation.wastedStackSeconds,
      generationEfficiency: generation.generationEfficiency,
      applications,
      conditions,
    };
  }).sort((a, b) => groupSortValue(a.group) - groupSortValue(b.group)
    || (b.effectiveRating ?? -1) - (a.effectiveRating ?? -1)
    || b.suppressedConditionMs - a.suppressedConditionMs || a.account.localeCompare(b.account));

  const aegisGainsByCast = new Map<string, EffectTransition[]>();
  let ambiguousAegisGains = 0;
  for (const gain of aegisState.gains) {
    const candidates = aegisCasts.filter(cast => cast.group === (groupsByAccount.get(gain.account) ?? 0)
      && gain.timeMs >= cast.timeMs - 250 && gain.timeMs <= cast.timeMs + cast.durationMs + 1_000);
    const matched = uniquelyClosest(gain, candidates, cast => gain.timeMs - (cast.timeMs + cast.durationMs));
    if (matched) aegisGainsByCast.set(matched.key, [...(aegisGainsByCast.get(matched.key) ?? []), gain]);
    else if (candidates.length > 1) ambiguousAegisGains += 1;
  }
  const aegisBlocksByCast = new Map<string, IncomingAttackAttempt[]>();
  const aegisConsumptionsByCast = new Map<string, IncomingAttackAttempt[]>();
  let ambiguousAegisBlocks = incomingAttacks.source === 'boon-transition-inference' ? incomingAttacks.ambiguousConsumptions : 0;
  for (const attempt of incomingAttacks.attempts.filter(event => event.outcome === 'aegis-block')) {
    const candidates = aegisCasts.filter(cast => cast.group === attempt.targetGroup
      && attempt.timeMs >= cast.timeMs && attempt.timeMs <= cast.pressureEndMs);
    if (candidates.length === 1) aegisBlocksByCast.set(candidates[0].key, [...(aegisBlocksByCast.get(candidates[0].key) ?? []), attempt]);
    else if (candidates.length > 1) ambiguousAegisBlocks += 1;
  }
  for (const attempt of incomingAttacks.attempts.filter(event => event.outcome === 'inferred-consumption')) {
    const candidates = aegisCasts.filter(cast => cast.group === attempt.targetGroup
      && attempt.timeMs >= cast.timeMs && attempt.timeMs <= cast.pressureEndMs);
    if (candidates.length === 1) aegisConsumptionsByCast.set(candidates[0].key,
      [...(aegisConsumptionsByCast.get(candidates[0].key) ?? []), attempt]);
  }
  const aegisAccounts = new Map<string, AegisCast[]>();
  for (const cast of aegisCasts) aegisAccounts.set(cast.account, [...(aegisAccounts.get(cast.account) ?? []), cast]);
  const aegis: AegisEffectivenessRow[] = [...aegisAccounts].map(([account, casts]) => {
    const group = casts[0].group;
    const groupAttempts = incomingAttacks.attempts.filter(attempt => attempt.targetGroup === group);
    const providerAttempts = groupAttempts.filter(attempt => casts.some(cast => attempt.timeMs >= cast.timeMs && attempt.timeMs <= cast.pressureEndMs));
    const readyAttempts = providerAttempts.filter(attempt => (attempt.aegisBefore ?? 0) > 0).length;
    const applications = casts.slice().sort((a, b) => a.timeMs - b.timeMs).map(cast => {
      const attackAttempts = groupAttempts.filter(attempt => attempt.timeMs >= cast.timeMs && attempt.timeMs <= cast.pressureEndMs);
      return {
        key: cast.key,
        skillId: cast.skillId,
        skillName: cast.skillName,
        icon: cast.icon,
        timeMs: cast.timeMs,
        endMs: cast.pressureEndMs,
        attackAttempts,
        confirmedBlocks: aegisBlocksByCast.get(cast.key)?.length ?? 0,
        inferredConsumptions: aegisConsumptionsByCast.get(cast.key)?.length ?? 0,
        correlatedRecipientGains: aegisGainsByCast.get(cast.key)?.length ?? 0,
      };
    });
    const realizedCasts = applications.filter(application => application.confirmedBlocks > 0 || application.inferredConsumptions > 0).length;
    const confirmedBlocks = applications.reduce((sum, application) => sum + application.confirmedBlocks, 0);
    const inferredConsumptions = applications.reduce((sum, application) => sum + application.inferredConsumptions, 0);
    const generation = alliedGeneration(report, account, 'Aegis');
    const skills = [...new Map(casts.map(cast => [cast.skillId, cast])).values()].map(skill => ({
      id: skill.skillId,
      name: skill.skillName,
      icon: skill.icon,
      casts: casts.filter(cast => cast.skillId === skill.skillId).length,
    }));
    return {
      account,
      group,
      profession: casts[0].profession,
      skills,
      casts: casts.length,
      realizedCasts,
      castConversion: incomingAttacks.source !== 'unavailable' && casts.length ? realizedCasts / casts.length : null,
      confirmedBlocks,
      inferredConsumptions,
      threatAttempts: providerAttempts.length,
      readyAttempts,
      readinessRating: providerAttempts.length ? readyAttempts / providerAttempts.length : null,
      otherBlocks: providerAttempts.filter(attempt => attempt.outcome === 'other-block').length,
      otherDefenses: providerAttempts.filter(attempt => attempt.outcome === 'other-defense').length,
      landedWhileAegisPresent: providerAttempts.filter(attempt => attempt.outcome === 'landed' && (attempt.aegisBefore ?? 0) > 0).length,
      correlatedRecipientGains: casts.reduce((sum, cast) => sum + (aegisGainsByCast.get(cast.key)?.length ?? 0), 0),
      generatedSeconds: generation.generatedStackSeconds,
      wastedSeconds: generation.wastedStackSeconds,
      generationEfficiency: generation.generationEfficiency,
      applications,
    };
  }).sort((a, b) => groupSortValue(a.group) - groupSortValue(b.group)
    || (b.castConversion ?? -1) - (a.castConversion ?? -1)
    || b.confirmedBlocks - a.confirmedBlocks || a.account.localeCompare(b.account));

  const targetableControls = controls.filter(control => Boolean(control.account));
  const responses = new Map<string, StunbreakResponseEvent[]>();
  for (const control of targetableControls) {
    const possible = stunbreakCasts.filter(cast => cast.account !== control.account && cast.timeMs >= control.timeMs && cast.timeMs <= control.timeMs + RESPONSE_WINDOW_MS)
      .sort((a, b) => a.timeMs - b.timeMs);
    const first = possible[0];
    if (first) {
      const response = {
        key: `${control.account}:${control.timeMs}:${first.key}`,
        eventTimeMs: control.timeMs,
        targetAccount: control.account,
        targetActor: control.actor,
        label: control.label,
        castTimeMs: first.timeMs,
        delayMs: first.timeMs - control.timeMs,
        skillId: first.skillId,
        skillName: first.skillName,
        icon: first.icon,
      };
      responses.set(first.account, [...(responses.get(first.account) ?? []), response]);
    }
  }

  const supportByAccount = new Map(report.stats.supportPlayers.map(player => [player.account, player]));
  const stunbreakAccounts = new Set([...supportByAccount.keys(), ...stunbreakCasts.map(cast => cast.account)]);
  const stunbreak: StunbreakEffectivenessRow[] = [...stunbreakAccounts].map(account => {
    const support = supportByAccount.get(account);
    const casts = stunbreakCasts.filter(cast => cast.account === account);
    const responseEvents = responses.get(account) ?? [];
    const confirmedBreaks = Math.max(0, finite(support?.supportTotals.stunBreak));
    const removedControlSeconds = Math.max(0, finite(support?.supportTotals.removedStunDuration));
    const skills = [...new Map(casts.map(cast => [cast.skillId, cast])).values()].map(skill => ({ id: skill.skillId, name: skill.skillName, icon: skill.icon,
      casts: casts.filter(cast => cast.skillId === skill.skillId).length }));
    return { account, group: groupsByAccount.get(account) ?? 0,
      profession: support?.profession ?? casts[0]?.profession ?? 'Unknown', skills, confirmedBreaks, removedControlSeconds,
      averagePreventedSeconds: confirmedBreaks ? removedControlSeconds / confirmedBreaks : null,
      correlatedResponses: responseEvents.length,
      averageCorrelatedDelayMs: responseEvents.length ? responseEvents.reduce((sum, response) => sum + response.delayMs, 0) / responseEvents.length : null,
      responseShare: targetableControls.length ? responseEvents.length / targetableControls.length : null,
      responseEvents };
  }).filter(row => row.confirmedBreaks > 0 || row.skills.length > 0)
    .sort((a, b) => groupSortValue(a.group) - groupSortValue(b.group)
      || b.confirmedBreaks - a.confirmedBreaks
      || (a.averageCorrelatedDelayMs ?? Infinity) - (b.averageCorrelatedDelayMs ?? Infinity)
      || a.account.localeCompare(b.account));

  const buildScope = (group: number | null): UtilityEffectivenessScope => {
    const inScope = (account?: string) => group === null || Boolean(account && (groupsByAccount.get(account) ?? 0) === group);
    const scopeMembers = [...groupsByAccount.keys()].filter(account => inScope(account));
    const scopeMemberCount = scopeMembers.length;
    const stabilityTimelineCoverage = scopeMemberCount
      ? scopeMembers.filter(account => transitions.statesByAccount.has(account)).length / scopeMemberCount : null;
    const aegisTimelineCoverage = scopeMemberCount
      ? scopeMembers.filter(account => aegisState.statesByAccount.has(account)).length / scopeMemberCount : null;
    const scopedControls = group === null ? controls : controls.filter(control => inScope(control.account));
    const scopedTargetableControls = group === null ? targetableControls : targetableControls.filter(control => inScope(control.account));
    const scopedStabilityCasts = group === null ? stabilityCasts : stabilityCasts.filter(cast => cast.group === group);
    const scopedResistanceCasts = group === null ? resistanceCasts : resistanceCasts.filter(cast => cast.group === group);
    const scopedAegisCasts = group === null ? aegisCasts : aegisCasts.filter(cast => cast.group === group);
    const scopedStunbreakCasts = group === null ? stunbreakCasts : stunbreakCasts.filter(cast => cast.group === group);
    const scopedStabilityRows = group === null ? stability : stability.filter(row => row.group === group);
    const scopedResistanceRows = group === null ? resistance : resistance.filter(row => row.group === group);
    const scopedAegisRows = group === null ? aegis : aegis.filter(row => row.group === group);
    const scopedStunbreakRows = group === null ? stunbreak : stunbreak.filter(row => row.group === group);
    const scopedAttempts = group === null ? incoming.attempts : incoming.attempts.filter(attempt => attempt.targetGroup === group);
    const scopedAttackAttempts = group === null ? incomingAttacks.attempts
      : incomingAttacks.attempts.filter(attempt => attempt.targetGroup === group);
    const scopedConditionIntervals = group === null ? conditionPressure.intervals
      : conditionPressure.intervals.filter(interval => interval.group === group);
    const scopedConditionArrivals = group === null ? conditionPressure.arrivals
      : conditionPressure.arrivals.filter(arrival => arrival.group === group);
    const resolvedAttempts = scopedAttempts.filter(attempt => attempt.outcome === 'intercepted' || attempt.outcome === 'controlled');
    const coveredControls = resolvedAttempts.filter(attempt => attempt.outcome === 'intercepted').length;
    const protectedAttempts = scopedAttempts.filter(attempt => (attempt.stabilityBefore ?? 0) > 0).length;
    const resolvedEvidence = scopedAttempts.filter(attempt => attempt.outcome !== 'unresolved').length;
    const pressureTimes = incoming.source === 'native-evtc' ? scopedAttempts.map(attempt => attempt.timeMs) : scopedControls.map(control => control.timeMs);
    const alignedCasts = scopedStabilityCasts.filter(cast => pressureTimes.some(timeMs => timeMs >= cast.timeMs && timeMs <= cast.pressureEndMs)).length;
    const matchedResponseDelays = scopedTargetableControls.flatMap(control => {
      const first = scopedStunbreakCasts.filter(cast => cast.account !== control.account && cast.timeMs >= control.timeMs
        && cast.timeMs <= control.timeMs + RESPONSE_WINDOW_MS).sort((a, b) => a.timeMs - b.timeMs)[0];
      return first ? [first.timeMs - control.timeMs] : [];
    });
    const generated = scopedStabilityRows.reduce((sum, row) => sum + (row.generatedStackSeconds ?? 0), 0);
    const wasted = scopedStabilityRows.reduce((sum, row) => sum + (row.wastedStackSeconds ?? 0), 0);
    const confirmedBreaks = scopedStunbreakRows.reduce((sum, row) => sum + row.confirmedBreaks, 0);
    const removedControlSeconds = scopedStunbreakRows.reduce((sum, row) => sum + row.removedControlSeconds, 0);
    const stabilityProviderAccounts = [...new Set(scopedStabilityRows.map(row => row.account))].sort((a, b) => a.localeCompare(b));
    const resistanceProviderAccounts = [...new Set(scopedResistanceRows.map(row => row.account))].sort((a, b) => a.localeCompare(b));
    const stunbreakProviderAccounts = [...new Set(scopedStunbreakRows.map(row => row.account))].sort((a, b) => a.localeCompare(b));
    const aegisProviderAccounts = [...new Set(scopedAegisRows.map(row => row.account))].sort((a, b) => a.localeCompare(b));
    const realizedAegisCasts = scopedAegisRows.reduce((sum, row) => sum + row.realizedCasts, 0);
    const inferredAegisConsumptions = scopedAegisRows.reduce((sum, row) => sum + row.inferredConsumptions, 0);
    const readyAegisAttempts = scopedAttackAttempts.filter(attempt => (attempt.aegisBefore ?? 0) > 0).length;
    const resistanceConditionMs = conditionPressureDuration(scopedConditionIntervals);
    const resistanceSuppressedMs = suppressedConditionDuration(scopedConditionIntervals, resistanceByAccount);
    const resistanceCoveredArrivals = scopedConditionArrivals.filter(arrival =>
      (stateAt(resistanceState.statesByAccount.get(arrival.account), Math.max(0, arrival.timeMs - 1)) ?? 0) > 0).length;
    const resistanceConditions = resistanceConditionEffectiveness(scopedConditionIntervals, scopedConditionArrivals,
      resistanceByAccount, resistanceState.statesByAccount, conditionArrivalAttributions);
    const conditionTrackedAccounts = new Set(scopedConditionIntervals.map(interval => interval.account));
    const resistanceTrackedAccounts = scopeMembers.filter(account => resistanceState.statesByAccount.has(account));
    return {
      key: group === null ? 'overall' : `group-${group}`,
      group,
      label: group === null ? 'Overall' : group > 0 ? `Party ${group}` : 'Unassigned',
      memberCount: scopeMemberCount,
      stability: {
        providerAccounts: stabilityProviderAccounts,
        effectiveRating: resolvedAttempts.length ? coveredControls / resolvedAttempts.length : null,
        coveredControls,
        eligibleControls: resolvedAttempts.length,
        casts: scopedStabilityCasts.length,
        alignedCasts,
        candidateNegatedControls: coveredControls,
        generationEfficiency: generated + wasted > 0 ? generated / (generated + wasted) : null,
        threatAttempts: scopedAttempts.length,
        protectedAttempts,
        readinessRating: scopedAttempts.length ? protectedAttempts / scopedAttempts.length : null,
        successfulControls: scopedAttempts.filter(attempt => attempt.outcome === 'controlled').length,
        otherDefenses: scopedAttempts.filter(attempt => attempt.outcome === 'other-defense').length,
        unresolvedAttempts: scopedAttempts.filter(attempt => attempt.outcome === 'unresolved').length,
        evidenceCoverage: incoming.source === 'native-evtc'
          ? (scopedAttempts.length ? resolvedEvidence / scopedAttempts.length : null)
          : stabilityTimelineCoverage,
      },
      resistance: {
        providerAccounts: resistanceProviderAccounts,
        effectiveRating: resistanceConditionMs > 0 ? resistanceSuppressedMs / resistanceConditionMs : null,
        conditionPressureMs: resistanceConditionMs,
        suppressedConditionMs: resistanceSuppressedMs,
        conditionArrivals: scopedConditionArrivals.length,
        coveredArrivals: resistanceCoveredArrivals,
        readinessRating: scopedConditionArrivals.length ? resistanceCoveredArrivals / scopedConditionArrivals.length : null,
        casts: scopedResistanceCasts.length,
        alignedCasts: scopedResistanceRows.reduce((sum, row) => sum + row.pressureAlignedCasts, 0),
        conditionTrackedPlayers: conditionTrackedAccounts.size,
        resistanceTrackedPlayers: resistanceTrackedAccounts.length,
        conditions: resistanceConditions,
      },
      aegis: {
        providerAccounts: aegisProviderAccounts,
        castConversion: incomingAttacks.source !== 'unavailable' && scopedAegisCasts.length
          ? realizedAegisCasts / scopedAegisCasts.length : null,
        casts: scopedAegisCasts.length,
        realizedCasts: realizedAegisCasts,
        confirmedBlocks: scopedAttackAttempts.filter(attempt => attempt.outcome === 'aegis-block').length,
        inferredConsumptions: inferredAegisConsumptions,
        threatAttempts: scopedAttackAttempts.length,
        readyAttempts: readyAegisAttempts,
        readinessRating: scopedAttackAttempts.length ? readyAegisAttempts / scopedAttackAttempts.length : null,
        otherBlocks: scopedAttackAttempts.filter(attempt => attempt.outcome === 'other-block').length,
        otherDefenses: scopedAttackAttempts.filter(attempt => attempt.outcome === 'other-defense').length,
        landedWhileAegisPresent: scopedAttackAttempts
          .filter(attempt => attempt.outcome === 'landed' && (attempt.aegisBefore ?? 0) > 0).length,
        evidenceCoverage: incomingAttacks.source === 'native-evtc'
          ? (scopedAttackAttempts.length ? scopedAttackAttempts.filter(attempt => attempt.outcome !== 'unresolved').length / scopedAttackAttempts.length : null)
          : aegisTimelineCoverage,
      },
      stunbreak: {
        providerAccounts: stunbreakProviderAccounts,
        effectiveRating: scopedTargetableControls.length ? matchedResponseDelays.length / scopedTargetableControls.length : null,
        matchedResponses: matchedResponseDelays.length,
        eligibleControls: scopedTargetableControls.length,
        confirmedBreaks,
        removedControlSeconds,
        averagePreventedSeconds: confirmedBreaks ? removedControlSeconds / confirmedBreaks : null,
        averageCorrelatedDelayMs: matchedResponseDelays.length
          ? matchedResponseDelays.reduce((sum, delay) => sum + delay, 0) / matchedResponseDelays.length : null,
      },
    };
  };
  const representedGroups = [...new Set([
    ...groupsByAccount.values(),
    ...stability.map(row => row.group),
    ...resistance.map(row => row.group),
    ...aegis.map(row => row.group),
    ...stunbreak.map(row => row.group),
  ])].sort((a, b) => groupSortValue(a) - groupSortValue(b));
  const subgroups = representedGroups.map(group => buildScope(group));
  const overall = buildScope(null);
  const observedSkillIds = new Set([
    ...(rotation?.players ?? []).flatMap(player => player.casts.map(cast => cast.skillId)),
    ...(report.stats.incomingSkillEvents?.fights.find(entry => entry.fightId === fightId)?.events ?? []).map(event => event.skillId),
  ]);

  return {
    fightId,
    fightName: rotation?.fightName ?? report.stats.mechanics?.fights.find(fight => fight.fightId === fightId)?.fightName ?? 'Selected fight',
    constants: { pressureWindowMs: PRESSURE_WINDOW_MS, controlProximityMs: CONTROL_PROXIMITY_MS,
      stabilityTransitionMatchMs: STABILITY_TRANSITION_MATCH_MS, responseWindowMs: RESPONSE_WINDOW_MS,
      conditionSourceMatchMs: CONDITION_SOURCE_MATCH_MS, conditionSourceAmbiguityMs: CONDITION_SOURCE_AMBIGUITY_MS,
      conditionTemporalCandidateMs: CONDITION_TEMPORAL_CANDIDATE_MS,
      conditionTemporalAmbiguityMs: CONDITION_TEMPORAL_AMBIGUITY_MS },
    coverage: { controlEvents: controls.length, targetableControlEvents: targetableControls.length,
      ambiguousStabilityGains: ambiguousGains,
      ambiguousStabilityLossUnits,
      ambiguousAegisGains,
      ambiguousAegisBlocks,
      stabilityCoveredControlEvents: incoming.source === 'native-evtc' ? overall.stability.protectedAttempts
        : controls.filter(control => stabilityCasts.some(cast => control.timeMs >= cast.timeMs && control.timeMs <= cast.pressureEndMs)).length,
      stabilityTrackedPlayers: transitions.trackedPlayers, replayRosterPlayers: transitions.rosterPlayers,
      incomingControlSource: incoming.source,
      incomingSkillEvents: incoming.rawEvents,
      classifiedIncomingSkillEvents: incoming.classifiedEvents,
      incomingControlAttempts: incoming.attempts.length,
      realizedInterceptions: incoming.source === 'native-evtc' ? overall.stability.coveredControls : 0,
      inferredStabilityInterceptions: incoming.source === 'mechanic-boon-inference' ? overall.stability.coveredControls : 0,
      resolvedControlContests: overall.stability.eligibleControls,
      successfulControls: overall.stability.successfulControls,
      otherDefenses: overall.stability.otherDefenses,
      unresolvedAttempts: overall.stability.unresolvedAttempts,
      evidenceCoverage: overall.stability.evidenceCoverage,
      resistanceTrackedPlayers: resistanceState.trackedPlayers,
      conditionTrackedPlayers: conditionPressure.trackedPlayers,
      observedConditionIntervals: conditionPressure.intervals.length,
      observedConditionArrivals: conditionPressure.arrivals.length,
      attributedConditionArrivals: overall.resistance.conditions.reduce((sum, condition) => sum + condition.attributedArrivals, 0),
      verifiedConditionArrivals: overall.resistance.conditions.reduce((sum, condition) => sum + condition.verifiedArrivals, 0),
      candidateConditionArrivals: overall.resistance.conditions.reduce((sum, condition) => sum + condition.candidateArrivals, 0),
      ambiguousConditionArrivals: overall.resistance.conditions.reduce((sum, condition) => sum + condition.ambiguousArrivals, 0),
      conditionPressureMs: overall.resistance.conditionPressureMs,
      suppressedConditionMs: overall.resistance.suppressedConditionMs,
      aegisTrackedPlayers: aegisState.trackedPlayers,
      incomingAttackSource: incomingAttacks.source,
      incomingAttackEvents: incomingAttacks.rawEvents,
      incomingAttackAttempts: incomingAttacks.attempts.length,
      confirmedAegisBlocks: overall.aegis.confirmedBlocks,
      inferredAegisConsumptions: overall.aegis.inferredConsumptions,
      aegisEvidenceCoverage: overall.aegis.evidenceCoverage,
      referencedSkills: references.size, observedFightSkills: observedSkillIds.size },
    incomingControlAttempts: incoming.attempts,
    incomingAttackAttempts: incomingAttacks.attempts,
    stability,
    resistance,
    aegis,
    stunbreak,
    subgroups,
    overall,
    limitations: [
      incoming.source === 'native-evtc'
        ? 'Realized effectiveness is confirmed Stability interceptions divided by resolved Stability contests. Other defenses and unresolved attempts do not enter that denominator.'
        : 'Estimated Stability effectiveness is early, uniquely attributable stack consumptions divided by those consumptions plus controls recorded as landed. It is an inference, not a confirmed hostile hit result.',
      'A confirmed interception requires a hostile API-classified hard-control skill result on a squad member, Stability immediately before impact, no successful control result, and a nearby Stability stack decrease.',
      'Conditional and traited control references remain visible but only become resolved contests when the event records either a control result or a matching Stability consumption.',
      'Blocked, evaded, blinded and absorbed attacks are classified as other defenses; they do not prove that Stability was tested.',
      'Provider credit requires exactly one same-party recorded Stability cast window at the interception moment. Overlapping providers remain unattributed instead of being awarded to the nearest cast.',
      incomingAttacks.source === 'native-evtc'
        ? 'A confirmed Aegis block requires Aegis immediately before impact, a native block result, and the Aegis boon disappearing within the matching window.'
        : 'Estimated Aegis conversion counts an application when Aegis disappears materially before its reference expiry inside exactly one same-party cast window. Strips and corrupts can also cause that transition, so it remains inferred.',
      'Aegis stacks duration. Reapplication extends the active coverage window; it does not overwrite an earlier application. Cast conversion therefore asks whether a recorded cast window produced at least one uniquely attributable block.',
      'Other blocks, evades, blinds and absorbs remain separate from Aegis. A hit recorded while Aegis appears present is flagged as unresolved because unblockable attacks and timestamp boundaries can bypass the simple state test.',
      'Overlapping same-party Aegis cast windows share no provider credit. Confirmed squad blocks remain counted while ambiguous provider attribution is reported separately.',
      'Correlated recipient gains are uniquely time-matched to one recorded Stability cast; simultaneous provider casts are left ambiguous.',
      'Resistance effectiveness is observed non-damaging-condition time overlapped by an active Resistance timeline. Blind, Chill, Cripple, Fear, Immobilize, Slow, Taunt, Weakness and Vulnerability are included; damaging conditions and hard-control states are excluded.',
      'Resistance arrival readiness asks whether Resistance was already active immediately before each observed non-damaging condition gain. Resistance is not consumed, so provider rows are correlated cast windows rather than unique source credit.',
      `A verified hostile source match requires the same target and API-classified condition within ${CONDITION_SOURCE_MATCH_MS}ms of the observed condition gain. Match certainty falls with timestamp distance and with traited or description-only references.`,
      `When the API cannot classify a condition source, one same-target hostile hit within ${CONDITION_TEMPORAL_CANDIDATE_MS}ms may be shown as a timing candidate at no more than 60% certainty. This is temporal attribution, not proof that the skill applied the condition.`,
      `Different verified skills within ${CONDITION_SOURCE_AMBIGUITY_MS}ms, or timing candidates within ${CONDITION_TEMPORAL_AMBIGUITY_MS}ms, remain ambiguous. Unmatched and ambiguous arrivals stay in the Resistance denominator but are never assigned to a hostile skill.`,
      'Condition pressure is measured as player-condition time: two simultaneous tracked conditions contribute two seconds per second. Missing replay condition or Resistance tracks are reported as missing evidence, never treated as zero pressure.',
      'Reports without native hostile hit timestamps use clearly labeled mechanic-and-boon inference. Re-importing the original EVTC or ZEVTC upgrades candidate consumptions to result-backed confirmation.',
      'Confirmed stun-break totals and removed duration are report aggregates. Removed duration is control time prevented, not time already spent stunned.',
      'Correlated response delay measures time from a recorded control mechanic to the next recorded allied stun-break cast. Recipient, range, subgroup and actual removal remain unverified.',
      'Subgroup assignments use the report-aggregate attendance source shared with Party Boons and may not reflect a mid-session party swap.',
      'A subgroup rating pairs mechanics recorded on that party with casts from providers assigned to the same party. Mechanics without a resolved account are excluded; cross-party help remains visible in Overall.',
    ],
  };
}

export function utilityEffectivenessSkillIds(report: WvWReport, fightId: string) {
  const fight = report.stats.rotations?.fights.find(entry => entry.fightId === fightId);
  const incoming = report.stats.incomingSkillEvents?.fights.find(entry => entry.fightId === fightId);
  return [...new Set([
    ...(fight?.players ?? []).flatMap(player => player.casts.map(cast => cast.skillId)),
    ...(incoming?.events ?? []).map(event => event.skillId),
  ].filter(id => Number.isSafeInteger(id) && id > 0))];
}
