import type { ReplayEffectTrack } from '../parseReplayData';
import type { Gw2Skill } from '../../types/buildEditor';
import type { RotationCast } from '../../types/report';

export type CooldownModifierKind = 'rate' | 'base-reduction' | 'fixed-reduction' | 'reset' | 'historical';

export interface CooldownModifierEvidence {
  id: string;
  name: string;
  kind: CooldownModifierKind;
  applied: boolean;
  certaintyPct: number;
  detail: string;
  impact: string;
  source: string;
}

export interface CooldownAssessmentContext {
  casts: RotationCast[];
  skillId: number;
  skill?: Gw2Skill;
  skillName?: string;
  profession?: string;
  skillMeta?: Record<number, { name: string; icon?: string }>;
  effects?: ReplayEffectTrack[];
  effectTimelineComplete?: boolean;
  gameMode?: 'pve' | 'pvp' | 'wvw';
  verifiedTraitIds?: number[];
  verifiedUpgradeIds?: number[];
}

export interface CooldownIntervalAssessment {
  baseMs: number;
  adjustedBaseMs: number;
  minimumProgressMs: number;
  maximumProgressMs: number;
  earliestReadyMs: number | null;
  latestReadyMs: number | null;
  remainingMinMs: number;
  remainingMaxMs: number;
  status: 'ready' | 'recharging' | 'uncertain';
  coveragePct: number;
  modifiers: CooldownModifierEvidence[];
  unexplainedShortfallMs: number;
}

type ScopeRule = {
  id: string;
  traitId: number;
  name: string;
  percent: number;
  scope: string;
  source: string;
  matches: (context: CooldownAssessmentContext) => boolean;
};

const elementalist = new Set(['Elementalist', 'Tempest', 'Weaver', 'Catalyst', 'Evoker']);
const guardian = new Set(['Guardian', 'Dragonhunter', 'Firebrand', 'Willbender', 'Luminary']);
const necromancer = new Set(['Necromancer', 'Reaper', 'Scourge', 'Harbinger', 'Ritualist']);
const warrior = new Set(['Warrior', 'Berserker', 'Spellbreaker', 'Bladesworn', 'Paragon']);
const ranger = new Set(['Ranger', 'Druid', 'Soulbeast', 'Untamed', 'Galeshot']);
const mesmer = new Set(['Mesmer', 'Chronomancer', 'Mirage', 'Virtuoso', 'Troubadour']);
const thief = new Set(['Thief', 'Daredevil', 'Deadeye', 'Specter', 'Antiquary']);
const engineer = new Set(['Engineer', 'Scrapper', 'Holosmith', 'Mechanist', 'Amalgam']);
const revenant = new Set(['Revenant', 'Herald', 'Renegade', 'Vindicator', 'Conduit']);

const SHROUD_SKILLS = new Set([29442, 29458, 30278, 30825, 29958, 30504, 30557]);
const ATTUNEMENT_SKILLS = new Set([5492, 5493, 5494, 5495, 76580, 76703, 76988, 77082]);
const AIR_ATTUNEMENT_SKILLS = new Set([5494, 76580]);
const TOME_ACTIVATIONS = new Set([44364, 41780, 42259]);
const RENEWED_FOCUS_SKILLS = new Set([9154, 68666]);
const LIFE_REAP_SKILLS = new Set([30278, 50858]);

const wiki = (name: string) => `https://wiki.guildwars2.com/wiki/${encodeURIComponent(name.replaceAll(' ', '_'))}`;
const professionIs = (context: CooldownAssessmentContext, family: Set<string>) => family.has(context.profession ?? '');
const skillName = (context: CooldownAssessmentContext) => context.skill?.name ?? context.skillName ?? context.skillMeta?.[context.skillId]?.name ?? `Skill ${context.skillId}`;
const weaponIs = (context: CooldownAssessmentContext, ...weapons: string[]) => weapons.some(weapon => context.skill?.weapon_type?.toLowerCase() === weapon.toLowerCase());
const textHas = (context: CooldownAssessmentContext, pattern: RegExp) => pattern.test(`${skillName(context)} ${context.skill?.description ?? ''} ${(context.skill?.categories ?? []).join(' ')}`);
const isWeaponSkill = (context: CooldownAssessmentContext) => context.skill?.type === 'Weapon' || /^Weapon_/.test(context.skill?.slot ?? '');
const slotIs = (context: CooldownAssessmentContext, ...slots: string[]) => slots.includes(context.skill?.slot ?? '');
const isToolBeltSkill = (context: CooldownAssessmentContext) => professionIs(context, engineer) && textHas(context, /tool.?belt/i) && !/engage photon forge/i.test(skillName(context));
const isPetSkill = (context: CooldownAssessmentContext) => professionIs(context, ranger) && context.skill?.type === 'Pet';
const isAttunement = (context: CooldownAssessmentContext) => ATTUNEMENT_SKILLS.has(context.skillId) || /attunement/i.test(skillName(context));
const isGuardianProfessionSkill = (context: CooldownAssessmentContext) => professionIs(context, guardian)
  && Boolean(TOME_ACTIVATIONS.has(context.skillId) || context.skill?.type === 'Profession' || context.skill?.slot?.startsWith('Profession'));
const isShroudSkill = (context: CooldownAssessmentContext) => professionIs(context, necromancer)
  && (SHROUD_SKILLS.has(context.skillId) || textHas(context, /shroud/i));

// Current API-backed percentage rules whose target scope can be established from the selected skill.
// They are applied only when an opt-in trait snapshot verifies the trait id.
const STATIC_TRAIT_RULES: ScopeRule[] = [
  { id: 'trait-elemental-enchantment', traitId: 2004, name: 'Elemental Enchantment', percent: 15, scope: 'elementalist attunements', source: wiki('Elemental Enchantment'), matches: context => professionIs(context, elementalist) && isAttunement(context) },
  { id: 'trait-aeromancers-training', traitId: 223, name: "Aeromancer's Training", percent: 20, scope: 'air weapon skills', source: wiki("Aeromancer's Training"), matches: context => professionIs(context, elementalist) && !context.skill?.dual_attunement && (context.skill?.attunement === 'Air' || textHas(context, /\bair\b/i)) && context.skill?.type === 'Weapon' },
  { id: 'trait-aquamancers-training', traitId: 1676, name: "Aquamancer's Training", percent: 20, scope: 'water weapon skills', source: wiki("Aquamancer's Training"), matches: context => professionIs(context, elementalist) && !context.skill?.dual_attunement && (context.skill?.attunement === 'Water' || textHas(context, /\bwater\b/i)) && context.skill?.type === 'Weapon' },
  { id: 'trait-geomancers-training', traitId: 280, name: "Geomancer's Training", percent: 20, scope: 'earth weapon skills', source: wiki("Geomancer's Training"), matches: context => professionIs(context, elementalist) && !context.skill?.dual_attunement && (context.skill?.attunement === 'Earth' || textHas(context, /\bearth\b/i)) && isWeaponSkill(context) },
  { id: 'trait-pyromancers-training', traitId: 319, name: "Pyromancer's Training", percent: 20, scope: 'fire weapon skills', source: wiki("Pyromancer's Training"), matches: context => professionIs(context, elementalist) && !context.skill?.dual_attunement && (context.skill?.attunement === 'Fire' || textHas(context, /\bfire\b/i)) && context.skill?.type === 'Weapon' },
  { id: 'trait-flow-state', traitId: 2138, name: 'Flow State', percent: 20, scope: 'weaver dual-attack skills', source: wiki('Flow State'), matches: context => context.profession === 'Weaver' && Boolean(context.skill?.dual_attunement) },
  { id: 'trait-power-virtuous', traitId: 620, name: 'Power of the Virtuous', percent: 15, scope: 'guardian virtues', source: wiki('Power of the Virtuous'), matches: isGuardianProfessionSkill },
  { id: 'trait-sinister-shroud', traitId: 891, name: 'Sinister Shroud', percent: 15, scope: 'shroud skills', source: wiki('Sinister Shroud'), matches: isShroudSkill },
  { id: 'trait-zealous-blade', traitId: 653, name: 'Zealous Blade', percent: 20, scope: 'greatsword skills', source: wiki('Zealous Blade'), matches: context => professionIs(context, guardian) && weaponIs(context, 'Greatsword') },
  { id: 'trait-radiant-fire', traitId: 567, name: 'Radiant Fire', percent: 20, scope: 'torch skills', source: wiki('Radiant Fire'), matches: context => professionIs(context, guardian) && weaponIs(context, 'Torch') },
  { id: 'trait-stalwart-defender', traitId: 580, name: 'Stalwart Defender', percent: 20, scope: 'shield skills', source: wiki('Stalwart Defender'), matches: context => professionIs(context, guardian) && weaponIs(context, 'Shield') },
  { id: 'trait-focus-mastery', traitId: 633, name: 'Focus Mastery', percent: 20, scope: 'guardian focus skills', source: wiki('Focus Mastery'), matches: context => professionIs(context, guardian) && weaponIs(context, 'Focus') },
  { id: 'trait-honorable-staff', traitId: 557, name: 'Honorable Staff', percent: 20, scope: 'guardian staff skills', source: wiki('Honorable Staff'), matches: context => professionIs(context, guardian) && weaponIs(context, 'Staff') },
  { id: 'trait-invigorated-bulwark', traitId: 1899, name: 'Invigorated Bulwark', percent: 20, scope: 'guardian mace skills', source: wiki('Invigorated Bulwark'), matches: context => professionIs(context, guardian) && weaponIs(context, 'Mace') },
  { id: 'trait-master-corruption', traitId: 816, name: 'Master of Corruption', percent: 33, scope: 'corruption skills', source: wiki('Master of Corruption'), matches: context => professionIs(context, necromancer) && textHas(context, /\bcorruption\b/i) },
  { id: 'trait-dark-gunslinger', traitId: 2209, name: 'Dark Gunslinger', percent: 20, scope: 'harbinger pistol skills', source: wiki('Dark Gunslinger'), matches: context => professionIs(context, necromancer) && weaponIs(context, 'Pistol') },
  { id: 'trait-axe-mastery', traitId: 1369, name: 'Axe Mastery', percent: 20, scope: 'axe skills', source: wiki('Axe Mastery'), matches: context => professionIs(context, warrior) && weaponIs(context, 'Axe') },
  { id: 'trait-blademaster', traitId: 1333, name: 'Blademaster', percent: 20, scope: 'sword skills', source: wiki('Blademaster'), matches: context => professionIs(context, warrior) && weaponIs(context, 'Sword') },
  { id: 'trait-forceful-greatsword', traitId: 1338, name: 'Forceful Greatsword', percent: 20, scope: 'greatsword and underwater spear skills', source: wiki('Forceful Greatsword'), matches: context => professionIs(context, warrior) && weaponIs(context, 'Greatsword', 'Spear') },
  { id: 'trait-crack-shot', traitId: 1329, name: 'Crack Shot', percent: 20, scope: 'longbow, rifle, and harpoon weapon skill 1', source: wiki('Crack Shot'), matches: context => professionIs(context, warrior) && weaponIs(context, 'Longbow', 'Rifle', 'Harpoon gun') && slotIs(context, 'Weapon_1') },
  { id: 'trait-versatile-power', traitId: 1417, name: 'Versatile Power', percent: 15, scope: 'burst skills', source: wiki('Versatile Power'), matches: context => professionIs(context, warrior) && textHas(context, /burst/i) },
  { id: 'trait-ambidexterity', traitId: 1101, name: 'Ambidexterity', percent: 20, scope: 'ranger torch and dagger skills', source: wiki('Ambidexterity'), matches: context => professionIs(context, ranger) && weaponIs(context, 'Torch', 'Dagger') },
  { id: 'trait-honed-axes', traitId: 970, name: 'Honed Axes', percent: 20, scope: 'ranger axe skills', source: wiki('Honed Axes'), matches: context => professionIs(context, ranger) && weaponIs(context, 'Axe') },
  { id: 'trait-lead-wind', traitId: 1698, name: 'Lead the Wind', percent: 20, scope: 'ranger longbow and harpoon-gun skills', source: wiki('Lead the Wind'), matches: context => professionIs(context, ranger) && weaponIs(context, 'Longbow', 'Harpoon gun') },
  { id: 'trait-light-feet', traitId: 1912, name: 'Light on your Feet', percent: 20, scope: 'ranger short-bow skills', source: wiki('Light on your Feet'), matches: context => professionIs(context, ranger) && weaponIs(context, 'Short bow', 'Shortbow') },
  { id: 'trait-pack-alpha', traitId: 1900, name: 'Pack Alpha', percent: 20, scope: 'ranger pet skills', source: wiki('Pack Alpha'), matches: isPetSkill },
  { id: 'trait-wardens-feedback', traitId: 751, name: "Warden's Feedback", percent: 20, scope: 'mesmer focus skills', source: wiki("Warden's Feedback"), matches: context => professionIs(context, mesmer) && weaponIs(context, 'Focus') },
  { id: 'trait-fencers-finesse', traitId: 708, name: "Fencer's Finesse", percent: 20, scope: 'mesmer sword and underwater spear skills', source: wiki("Fencer's Finesse"), matches: context => professionIs(context, mesmer) && weaponIs(context, 'Sword', 'Spear') },
  { id: 'trait-master-misdirection', traitId: 731, name: 'Master of Misdirection', percent: 15, scope: 'mesmer shatter skills', source: wiki('Master of Misdirection'), matches: context => professionIs(context, mesmer) && textHas(context, /\bshatter\b|mind wrack|cry of frustration|diversion|distortion/i) },
  { id: 'trait-lead-attacks', traitId: 1157, name: 'Lead Attacks', percent: 15, scope: 'Steal', source: wiki('Lead Attacks'), matches: context => professionIs(context, thief) && /steal|deadeye.?s mark|siphon|skritt swipe/i.test(skillName(context)) },
  { id: 'trait-sleight-of-hand', traitId: 1158, name: 'Sleight of Hand', percent: 20, scope: 'Steal', source: wiki('Sleight of Hand'), matches: context => professionIs(context, thief) && /steal|deadeye.?s mark/i.test(skillName(context)) },
  { id: 'trait-mechanized-deployment', traitId: 1872, name: 'Mechanized Deployment', percent: 15, scope: 'engineer tool-belt skills', source: wiki('Mechanized Deployment'), matches: isToolBeltSkill },
  { id: 'trait-jade-dynamo', traitId: 2292, name: 'Mech Core: Jade Dynamo', percent: 20, scope: 'mech-command skills', source: wiki('Mech Core: Jade Dynamo'), matches: context => professionIs(context, engineer) && textHas(context, /mech command/i) },
];

function stateAt(effect: ReplayEffectTrack | undefined, timeMs: number, complete: boolean): boolean | null {
  let last = -Infinity;
  let value: number | null = null;
  for (const [time, stacks] of effect?.states ?? []) {
    if (Number.isFinite(time) && Number.isFinite(stacks) && time <= timeMs && time >= last) {
      last = time;
      value = stacks;
    }
  }
  if (value === null) return complete ? false : null;
  return value > 0;
}

function continuousRecharge(
  startMs: number,
  endMs: number,
  targetMs: number,
  effects: ReplayEffectTrack[],
  complete: boolean,
  alacrityRate: number,
) {
  const alacrity = effects.find(effect => effect.name === 'Alacrity');
  const chilled = effects.find(effect => effect.name === 'Chilled' || effect.name === 'Chill');
  const resistance = effects.find(effect => effect.name === 'Resistance');
  const times = [...new Set([startMs, endMs, ...[alacrity, chilled, resistance]
    .flatMap(effect => (effect?.states ?? []).map(([time]) => time))
    .filter(time => Number.isFinite(time) && time > startMs && time < endMs)])].sort((a, b) => a - b);
  let minimumProgressMs = 0;
  let maximumProgressMs = 0;
  let alacrityMs = 0;
  let chilledMs = 0;
  let effectiveChillMs = 0;
  let suppressedChillMs = 0;
  let resistanceMs = 0;
  let overlapMs = 0;
  let unknownMs = 0;
  let earliestReadyMs: number | null = null;
  let latestReadyMs: number | null = null;

  for (let index = 1; index < times.length; index++) {
    const time = times[index - 1];
    const duration = times[index] - time;
    const hasAlacrity = stateAt(alacrity, time, complete);
    const hasChill = stateAt(chilled, time, complete);
    const hasResistance = stateAt(resistance, time, complete);
    if (hasAlacrity === true) alacrityMs += duration;
    if (hasChill === true) chilledMs += duration;
    if (hasResistance === true) resistanceMs += duration;
    if (hasChill === true && hasResistance === true) suppressedChillMs += duration;
    else if (hasChill === true) effectiveChillMs += duration;
    if (hasAlacrity === true && hasChill === true && hasResistance !== true) overlapMs += duration;

    let low = 1 / 1.66;
    let high = alacrityRate;
    const chillEffective = hasChill === true && hasResistance !== true;
    if (hasAlacrity !== null && hasChill !== null && hasResistance !== null) {
      if (chillEffective && hasAlacrity) {
        // The exported state establishes overlap, but not the game's modifier ordering.
        low = 1 / 1.66;
        high = alacrityRate;
      } else if (chillEffective) low = high = 1 / 1.66;
      else low = high = hasAlacrity ? alacrityRate : 1;
    } else unknownMs += duration;
    if (earliestReadyMs === null && maximumProgressMs + duration * high >= targetMs) {
      earliestReadyMs = time + (targetMs - maximumProgressMs) / high;
    }
    if (latestReadyMs === null && minimumProgressMs + duration * low >= targetMs) {
      latestReadyMs = time + (targetMs - minimumProgressMs) / low;
    }
    minimumProgressMs += duration * low;
    maximumProgressMs += duration * high;
  }
  return {
    minimumProgressMs,
    maximumProgressMs,
    alacrityMs,
    chilledMs,
    effectiveChillMs,
    suppressedChillMs,
    resistanceMs,
    overlapMs,
    unknownMs,
    earliestReadyMs: earliestReadyMs === null ? null : Math.round(earliestReadyMs),
    latestReadyMs: latestReadyMs === null ? null : Math.round(latestReadyMs),
  };
}

function completeRenewedFocusCasts(context: CooldownAssessmentContext, startMs: number, endMs: number) {
  if (!isGuardianProfessionSkill(context)) return [];
  return context.casts.flatMap(cast => {
    const name = context.skillMeta?.[cast.skillId]?.name ?? '';
    if (!RENEWED_FOCUS_SKILLS.has(cast.skillId) && name !== 'Renewed Focus') return [];
    // EI duration is needed to distinguish a completed channel from a canceled attempt.
    if (!Number.isFinite(cast.duration) || cast.duration < 2500) return [];
    const completionMs = cast.castTime + cast.duration;
    return completionMs > startMs && completionMs <= endMs ? [completionMs] : [];
  });
}

function candidateRules(context: CooldownAssessmentContext, startMs: number, endMs: number, hasUnexplainedGap: boolean): CooldownModifierEvidence[] {
  const candidates: CooldownModifierEvidence[] = [];
  const traits = new Set(context.verifiedTraitIds ?? []);
  const upgrades = new Set(context.verifiedUpgradeIds ?? []);
  const traitFit = (traitId: number, triggerEvidence = false) => traits.has(traitId)
    ? triggerEvidence ? 88 : 66
    : triggerEvidence && hasUnexplainedGap ? 56 : hasUnexplainedGap ? 38 : 20;
  const traitDetail = (traitId: number) => traits.has(traitId) ? 'Trait snapshot verified.' : 'Trait is not captured.';
  const castCount = (pattern: RegExp) => context.casts.filter(cast => cast.castTime > startMs && cast.castTime <= endMs
    && pattern.test(context.skillMeta?.[cast.skillId]?.name ?? '')).length;
  const relevantStatic = STATIC_TRAIT_RULES.filter(rule => rule.matches(context) && !traits.has(rule.traitId));
  for (const rule of relevantStatic) candidates.push({ id: rule.id, name: rule.name, kind: 'base-reduction', applied: false,
    certaintyPct: hasUnexplainedGap ? 48 : 24, detail: `Would reduce base recharge by ${rule.percent}% for ${rule.scope}; trait is not captured.`,
    impact: `up to ${rule.percent}%`, source: rule.source });

  if (professionIs(context, elementalist) && AIR_ATTUNEMENT_SKILLS.has(context.skillId)) candidates.push({
    id: 'trait-fresh-air', name: 'Fresh Air', kind: 'reset', applied: false, certaintyPct: traitFit(1503),
    detail: `${traitDetail(1503)} A critical hit can fully recharge Air Attunement, but the triggering hit is not verified here.`,
    impact: 'up to a full reset', source: wiki('Fresh Air'),
  });

  if (context.profession === 'Weaver' && isAttunement(context)) candidates.push({
    id: 'trait-flow-state-attunement', name: 'Flow State', kind: 'fixed-reduction', applied: false,
    certaintyPct: traitFit(2138), detail: `${traitDetail(2138)} The API records a one-second attunement reduction, but the Weave Self exception state is not connected to this interval.`,
    impact: 'up to -1s base recharge', source: wiki('Flow State'),
  });

  if (isShroudSkill(context)) {
    const lifeReaps = context.casts.filter(cast => cast.castTime > startMs && cast.castTime <= endMs
      && (LIFE_REAP_SKILLS.has(cast.skillId) || context.skillMeta?.[cast.skillId]?.name === 'Life Reap')).length;
    candidates.push({ id: 'trait-reapers-onslaught', name: "Reaper's Onslaught", kind: 'fixed-reduction', applied: false,
      certaintyPct: traitFit(2021, lifeReaps > 0),
      detail: `${traitDetail(2021)} ${lifeReaps} Life Reap cast${lifeReaps === 1 ? '' : 's'} recorded in this interval; successful hits are not proven.`,
      impact: `0-${lifeReaps}s possible recharge`, source: wiki("Reaper's Onslaught") });
  }

  if (professionIs(context, ranger) && isWeaponSkill(context) && !slotIs(context, 'Weapon_1')) {
    const swaps = castCount(/^Weapon Swap$/i);
    candidates.push({ id: 'trait-quick-draw', name: 'Quick Draw', kind: 'base-reduction', applied: false,
      certaintyPct: traitFit(1064, swaps > 0), detail: `${traitDetail(1064)} ${swaps} weapon swap${swaps === 1 ? '' : 's'} recorded in this interval; the log does not prove this was the first eligible weapon skill after the swap.`,
      impact: 'up to -66% for one cast', source: wiki('Quick Draw') });
  }

  if (professionIs(context, engineer) && slotIs(context, 'Elite')) candidates.push({
    id: 'trait-power-wrench', name: 'Power Wrench', kind: 'fixed-reduction', applied: false,
    certaintyPct: traitFit(531), detail: `${traitDetail(531)} Player dodge triggers are not connected to this palette interval.`,
    impact: '0-3s per qualifying dodge', source: wiki('Power Wrench'),
  });

  if (isToolBeltSkill(context)) candidates.push({
    id: 'trait-adrenal-implant', name: 'Adrenal Implant', kind: 'fixed-reduction', applied: false,
    certaintyPct: traitFit(523), detail: `${traitDetail(523)} The API records one second of tool-belt recharge per dodge; player dodge triggers are not connected to this interval.`,
    impact: '0-1s per qualifying dodge', source: wiki('Adrenal Implant'),
  });

  if (professionIs(context, mesmer) && isWeaponSkill(context)) candidates.push({
    id: 'trait-chaotic-interruption', name: 'Chaotic Interruption', kind: 'fixed-reduction', applied: false,
    certaintyPct: traitFit(669), detail: `${traitDetail(669)} A player-attributed interrupt and the randomly selected recharging weapon skill are not established.`,
    impact: '0-5s per qualifying interrupt', source: wiki('Chaotic Interruption'),
  });

  if (professionIs(context, mesmer) && weaponIs(context, 'Pistol')) candidates.push({
    id: 'trait-duelists-discipline', name: "Duelist's Discipline", kind: 'fixed-reduction', applied: false,
    certaintyPct: traitFit(700), detail: `${traitDetail(700)} Interrupt attribution and the trait's three-second interval are not reconstructed.`,
    impact: '0-25% per qualifying interrupt', source: wiki("Duelist's Discipline"),
  });

  if (context.profession === 'Mirage' && /mind wrack|cry of frustration/i.test(skillName(context))) candidates.push({
    id: 'trait-dune-cloak', name: 'Dune Cloak', kind: 'fixed-reduction', applied: false,
    certaintyPct: traitFit(2169), detail: `${traitDetail(2169)} Mirage Cloak gains from shatters are not reconstructed with the clone threshold and exact affected skill.`,
    impact: '0-2s per qualifying trigger', source: wiki('Dune Cloak'),
  });

  if (context.profession === 'Troubadour' && /crescendo/i.test(skillName(context))) candidates.push({
    id: 'trait-altered-chord', name: 'Altered Chord', kind: 'fixed-reduction', applied: false,
    certaintyPct: traitFit(2441), detail: `${traitDetail(2441)} Instrument plays and consumed-note state are not joined to this Crescendo interval.`,
    impact: '0-2s per qualifying instrument play', source: wiki('Altered Chord'),
  });

  if (professionIs(context, thief) && slotIs(context, 'Heal', 'Utility', 'Elite')) {
    const steals = castCount(/^(Steal|Deadeye.?s Mark|Siphon|Skritt Swipe)$/i);
    candidates.push({ id: 'trait-improvisation', name: 'Improvisation', kind: 'fixed-reduction', applied: false,
      certaintyPct: traitFit(1167, steals > 0), detail: `${traitDetail(1167)} ${steals} steal-family cast${steals === 1 ? '' : 's'} recorded; a full active utility bar and the trigger's effect on this exact skill are not proven.`,
      impact: `0-${steals * 25}% possible recharge`, source: wiki('Improvisation') });
  }

  if (professionIs(context, thief) && /steal|deadeye.?s mark|siphon|skritt swipe/i.test(skillName(context))) candidates.push({
    id: 'trait-swindlers-equilibrium', name: "Swindler's Equilibrium", kind: 'fixed-reduction', applied: false,
    certaintyPct: traitFit(1192), detail: `${traitDetail(1192)} Successful evades while wielding sword or underwater spear are not connected to this interval.`,
    impact: context.gameMode === 'pve' ? '0-2s per qualifying evade' : '0-1s per qualifying evade', source: wiki("Swindler's Equilibrium"),
  });

  if (professionIs(context, warrior) && textHas(context, /\bburst\b/i)) candidates.push({
    id: 'trait-heightened-focus', name: 'Heightened Focus', kind: 'reset', applied: false,
    certaintyPct: traitFit(1317), detail: `${traitDetail(1317)} A hit against a target below 50% health is not established from rotation starts.`,
    impact: 'up to a full burst reset', source: wiki('Heightened Focus'),
  });

  if (context.profession === 'Dragonhunter' && /spear of justice/i.test(skillName(context))) candidates.push({
    id: 'trait-defenders-dogma', name: "Defender's Dogma", kind: 'fixed-reduction', applied: false,
    certaintyPct: 70, detail: "Dragonhunter proves the mandatory minor trait, but this player's successful block triggers are not reconstructed.",
    impact: '0-3s per qualifying block', source: wiki("Defender's Dogma"),
  });

  if (professionIs(context, guardian) && (slotIs(context, 'Profession_1') || context.skillId === 44364)) candidates.push({
    id: 'trait-renewed-justice', name: 'Renewed Justice', kind: 'reset', applied: false,
    certaintyPct: traitFit(571), detail: `${traitDetail(571)} A player-attributed qualifying kill is not connected to this interval.`,
    impact: 'up to a full Virtue 1 reset', source: wiki('Renewed Justice'),
  });

  if (professionIs(context, guardian) && (slotIs(context, 'Profession_3') || context.skillId === 42259)) candidates.push({
    id: 'trait-tenacious-defense', name: 'Tenacious Defense', kind: 'fixed-reduction', applied: false,
    certaintyPct: traitFit(589), detail: `${traitDetail(589)} Aegis granted by this player and consumed by a blocking ally are not causally joined.`,
    impact: '0-1s per qualifying Aegis block', source: wiki('Tenacious Defense'),
  });

  if (context.profession === 'Deadeye' && slotIs(context, 'Heal', 'Utility', 'Elite')) candidates.push({
    id: 'trait-payback', name: 'Payback', kind: 'fixed-reduction', applied: false,
    certaintyPct: traitFit(2078), detail: `${traitDetail(2078)} Renewing Gaze from defeating the marked target is not player-attributed in this interval.`,
    impact: '0-20% per qualifying mark defeat', source: wiki('Payback'),
  });

  if (context.profession === 'Willbender' && isWeaponSkill(context)) candidates.push({
    id: 'trait-restorative-virtues', name: 'Restorative Virtues', kind: 'fixed-reduction', applied: false,
    certaintyPct: traitFit(2197), detail: `${traitDetail(2197)} Triggered virtue effects are not joined to the active weapon state, and the API does not expose a usable reduction amount.`,
    impact: 'amount unresolved by API', source: wiki('Restorative Virtues'),
  });

  if (context.profession === 'Luminary' && isWeaponSkill(context)) candidates.push({
    id: 'trait-master-at-arms', name: 'Master-at-Arms', kind: 'reset', applied: false,
    certaintyPct: traitFit(2388), detail: `${traitDetail(2388)} The matching virtue-to-radiant-weapon trigger is not yet resolved from this cast interval.`,
    impact: 'up to a full weapon-skill reset', source: wiki('Master-at-Arms'),
  });

  if (context.profession === 'Ritualist' && textHas(context, /\bspirit\b/i)) candidates.push({
    id: 'trait-soul-twisting', name: 'Soul Twisting', kind: 'reset', applied: false,
    certaintyPct: traitFit(2392), detail: `${traitDetail(2392)} The first spirit skill after entering ritualist shroud is not established.`,
    impact: 'up to one full reset per shroud entry', source: wiki('Soul Twisting'),
  });

  if (context.profession === 'Antiquary' && /skritt swipe/i.test(skillName(context))) candidates.push({
    id: 'trait-repeat-ransacker', name: 'Repeat Ransacker', kind: 'fixed-reduction', applied: false,
    certaintyPct: traitFit(2365), detail: `${traitDetail(2365)} Artifact activations are not yet classified as triggers in the rotation stream.`,
    impact: '0-2s per artifact use', source: wiki('Repeat Ransacker'),
  });

  if (context.profession === 'Amalgam' && textHas(context, /\bmorph\b/i)) candidates.push({
    id: 'trait-symbiotic-synergy', name: 'Symbiotic Synergy', kind: 'reset', applied: false,
    certaintyPct: traitFit(2406), detail: `${traitDetail(2406)} An Evolve trigger before this selected morph skill is not established.`,
    impact: 'up to a full morph reset', source: wiki('Symbiotic Synergy'),
  });

  if (context.profession === 'Amalgam' && /evolve/i.test(skillName(context))) candidates.push({
    id: 'trait-mercurial-tendencies', name: 'Mercurial Tendencies', kind: 'fixed-reduction', applied: false,
    certaintyPct: traitFit(2420), detail: `${traitDetail(2420)} Outgoing disables are not player-attributed to the selected Evolve interval.`,
    impact: '0-3s per qualifying disable', source: wiki('Mercurial Tendencies'),
  });

  if (context.profession === 'Galeshot' && /bluster/i.test(skillName(context))) {
    const resetTriggers = castCount(/^(Quarry's Peril|Supersonic Arrow)$/i);
    candidates.push({ id: 'trait-cloudburst', name: 'Cloudburst', kind: 'reset', applied: false,
      certaintyPct: traitFit(2425, resetTriggers > 0), detail: `${traitDetail(2425)} ${resetTriggers} reset-trigger cast${resetTriggers === 1 ? '' : 's'} recorded; activation completion is not proven.`,
      impact: 'up to a full Bluster reset', source: wiki('Cloudburst') });
  }

  if (context.profession === 'Paragon' && textHas(context, /\bchant\b/i)) candidates.push({
    id: 'trait-feverish-pulse', name: 'Feverish Pulse', kind: 'fixed-reduction', applied: false,
    certaintyPct: traitFit(2369), detail: `${traitDetail(2369)} Other chant activations are not yet classified against this selected chant.`,
    impact: '0-2s per other chant use', source: wiki('Feverish Pulse'),
  });

  if (context.profession === 'Renegade' && textHas(context, /band together/i)) candidates.push({
    id: 'trait-all-for-one', name: 'All for One', kind: 'fixed-reduction', applied: false,
    certaintyPct: traitFit(2108), detail: `${traitDetail(2108)} Band Together trigger state and which enhanced skill received the reduction are not reconstructed.`,
    impact: '33-50% per qualifying trigger', source: wiki('All for One'),
  });

  if (context.profession === 'Conduit' && professionIs(context, revenant) && textHas(context, /\binvoke|legendary\b/i)) candidates.push({
    id: 'trait-enhanced-embodiment', name: 'Enhanced Embodiment', kind: 'base-reduction', applied: false,
    certaintyPct: traitFit(2379), detail: `${traitDetail(2379)} The API exposes multiple recharge-reduction values; the active Cosmic Wisdom tier is not resolved here.`,
    impact: '20-40% invocation reduction', source: wiki('Enhanced Embodiment'),
  });

  if (context.profession === 'Evoker' && isWeaponSkill(context)) candidates.push({
    id: 'trait-elemental-balance', name: 'Elemental Balance', kind: 'base-reduction', applied: false,
    certaintyPct: traitFit(2436), detail: `${traitDetail(2436)} The every-second-attunement trigger and next eligible weapon cast are not reconstructed.`,
    impact: 'up to -66% for one cast', source: wiki('Elemental Balance'),
  }, {
    id: 'trait-specialized-elements', name: 'Specialized Elements', kind: 'fixed-reduction', applied: false,
    certaintyPct: traitFit(2437), detail: `${traitDetail(2437)} Familiar activation strength and affected active weapon skills are not reconstructed.`,
    impact: '0-33% per familiar activation', source: wiki('Specialized Elements'),
  });

  if (professionIs(context, warrior)) candidates.push({
    id: 'trait-martial-cadence', name: 'Martial Cadence', kind: 'historical', applied: false, certaintyPct: 100,
    detail: "Current Martial Cadence refreshes Soldier's Focus on weapon swap. Its weapon-skill recharge reduction was removed in 2022.",
    impact: '0s current skill recharge', source: wiki('Martial Cadence'),
  });

  candidates.push({ id: 'sigil-frenzy', name: 'Superior Sigil of Frenzy', kind: 'fixed-reduction', applied: false,
    certaintyPct: upgrades.has(82876) ? 55 : hasUnexplainedGap ? 30 : 15,
    detail: `${upgrades.has(82876) ? 'Sigil is snapshot-verified, but qualifying kill timestamps are unavailable.' : 'Sigil and qualifying kill timestamps are not captured.'} It has a 10-second internal cooldown.`,
    impact: '2.0s per qualifying kill', source: wiki('Superior Sigil of Frenzy') });
  return candidates;
}

export function assessCooldownInterval(
  startMs: number,
  endMs: number,
  baseMs: number,
  context: CooldownAssessmentContext,
): CooldownIntervalAssessment {
  const valid = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs && Number.isFinite(baseMs) && baseMs > 0;
  if (!valid) return { baseMs, adjustedBaseMs: baseMs, minimumProgressMs: 0, maximumProgressMs: 0,
    earliestReadyMs: null, latestReadyMs: null,
    remainingMinMs: Math.max(0, baseMs), remainingMaxMs: Math.max(0, baseMs), status: 'uncertain', coveragePct: 0,
    modifiers: [], unexplainedShortfallMs: Math.max(0, baseMs) };

  const verifiedTraits = new Set(context.verifiedTraitIds ?? []);
  const appliedStatic = STATIC_TRAIT_RULES.filter(rule => verifiedTraits.has(rule.traitId) && rule.matches(context));
  const staticFactor = appliedStatic.reduce((factor, rule) => factor * (1 - rule.percent / 100), 1);
  const adjustedBaseMs = baseMs * staticFactor;
  const hasTimeMarchesOn = context.profession === 'Chronomancer';
  const timeMarchesOnRate = context.gameMode === 'wvw' || context.gameMode === 'pvp' ? 1.33 : 1.5;
  const alacrityRate = hasTimeMarchesOn ? timeMarchesOnRate : 1.25;
  const continuous = continuousRecharge(
    startMs,
    endMs,
    adjustedBaseMs,
    context.effects ?? [],
    context.effectTimelineComplete === true,
    alacrityRate,
  );
  let minimumProgressMs = continuous.minimumProgressMs;
  let maximumProgressMs = continuous.maximumProgressMs;
  let earliestReadyMs = continuous.earliestReadyMs;
  let latestReadyMs = continuous.latestReadyMs;
  const modifiers: CooldownModifierEvidence[] = appliedStatic.map(rule => ({ id: rule.id, name: rule.name, kind: 'base-reduction', applied: true,
    certaintyPct: 96, detail: `Verified trait snapshot; applies to ${rule.scope}.`, impact: `-${rule.percent}% base recharge`, source: rule.source }));

  if (hasTimeMarchesOn) modifiers.push({
    id: 'trait-time-marches-on',
    name: 'Time Marches On',
    kind: 'rate',
    applied: true,
    certaintyPct: 99,
    detail: `Chronomancer's mandatory minor trait strengthens Alacrity in ${context.gameMode === 'wvw' ? 'WvW' : context.gameMode === 'pvp' ? 'PvP' : 'PvE'}.`,
    impact: `${alacrityRate.toFixed(2)}x while Alacrity is active`,
    source: wiki('Time Marches On'),
  });
  if (continuous.alacrityMs > 0) modifiers.push({ id: 'effect-alacrity', name: 'Alacrity', kind: 'rate', applied: true,
    certaintyPct: continuous.overlapMs ? 82 : 98, detail: `${(continuous.alacrityMs / 1000).toFixed(1)}s recorded in this interval.`,
    impact: continuous.overlapMs ? `${alacrityRate.toFixed(2)}x outside Chill overlap` : `${alacrityRate.toFixed(2)}x recharge rate`, source: wiki('Alacrity') });
  if (continuous.chilledMs > 0) modifiers.push({ id: 'effect-chilled', name: 'Chilled', kind: 'rate', applied: true,
    certaintyPct: continuous.overlapMs ? 82 : 98,
    detail: `${(continuous.chilledMs / 1000).toFixed(1)}s recorded; ${(continuous.suppressedChillMs / 1000).toFixed(1)}s suppressed by Resistance.`,
    impact: continuous.effectiveChillMs === 0
      ? '0.0s effective'
      : continuous.overlapMs
        ? `0.602x-${alacrityRate.toFixed(2)}x during overlap`
        : `0.602x for ${(continuous.effectiveChillMs / 1000).toFixed(1)}s`,
    source: wiki('Chilled') });
  if (continuous.resistanceMs > 0) modifiers.push({ id: 'effect-resistance', name: 'Resistance', kind: 'rate', applied: true,
    certaintyPct: 96, detail: `${(continuous.resistanceMs / 1000).toFixed(1)}s recorded in this interval.`, impact: 'suppresses Chill while active', source: wiki('Resistance') });

  const resets = completeRenewedFocusCasts(context, startMs, endMs);
  if (resets.length) {
    const firstResetMs = resets[0];
    earliestReadyMs = earliestReadyMs === null ? firstResetMs : Math.min(earliestReadyMs, firstResetMs);
    latestReadyMs = latestReadyMs === null ? firstResetMs : Math.min(latestReadyMs, firstResetMs);
    minimumProgressMs = adjustedBaseMs;
    maximumProgressMs = adjustedBaseMs;
    modifiers.push({ id: 'skill-renewed-focus', name: 'Renewed Focus', kind: 'reset', applied: true, certaintyPct: 94,
      detail: `Completed channel recorded at ${(resets.at(-1)! / 1000).toFixed(1)}s; applies to Guardian profession skills, not ordinary weapon or utility skills.`,
      impact: 'full profession-skill reset', source: wiki('Renewed Focus') });
  }

  minimumProgressMs = Math.min(adjustedBaseMs, minimumProgressMs);
  maximumProgressMs = Math.min(adjustedBaseMs, maximumProgressMs);

  const remainingMinMs = Math.max(0, adjustedBaseMs - maximumProgressMs);
  const remainingMaxMs = Math.max(0, adjustedBaseMs - minimumProgressMs);
  const status = remainingMaxMs === 0 ? 'ready' : remainingMinMs === 0 ? 'uncertain' : 'recharging';
  const unexplainedShortfallMs = status === 'recharging' ? remainingMinMs : 0;
  const hasUnexplainedGap = endMs > startMs && status !== 'ready';
  modifiers.push(...candidateRules(context, startMs, endMs, hasUnexplainedGap));

  let coveragePct = context.effectTimelineComplete ? 72 : 48;
  if (context.skill) coveragePct += 12;
  if ((context.verifiedTraitIds?.length ?? 0) > 0) coveragePct += 8;
  if ((context.verifiedUpgradeIds?.length ?? 0) > 0) coveragePct += 6;
  if (continuous.overlapMs || continuous.unknownMs) coveragePct -= 10;
  if (hasTimeMarchesOn) coveragePct += 4;
  if (modifiers.some(modifier => modifier.kind === 'reset' && modifier.applied)) coveragePct += 2;

  return { baseMs, adjustedBaseMs, minimumProgressMs, maximumProgressMs, earliestReadyMs, latestReadyMs,
    remainingMinMs, remainingMaxMs, status,
    coveragePct: Math.max(0, Math.min(98, Math.round(coveragePct))), modifiers, unexplainedShortfallMs };
}
