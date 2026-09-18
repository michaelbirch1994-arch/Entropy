import type { RotationCast } from '../../types/report';
import type { Gw2Skill } from '../../types/buildEditor';
import {
  DRUID_CELESTIAL_AVATAR_SKILL_IDS,
  FIREBRAND_TOME_ACTIVATION_SKILL_IDS,
  firebrandTomeSkills,
} from '../axiforge/nestedMechanicSkills';

export type SkillReferenceSource = 'api' | 'wiki-wvw' | 'recorded' | 'documented';

export interface PlayerPaletteSkill {
  id: number;
  skill?: Gw2Skill;
  source: SkillReferenceSource;
  uses: number;
  lastUseMs: number | null;
}

export interface PlayerPaletteBar {
  key: string;
  label: string;
  source: SkillReferenceSource;
  slots: Array<PlayerPaletteSkill | null>;
}

export interface PlayerSkillPalette {
  utilitySlots: Array<PlayerPaletteSkill | null>;
  mechanics: PlayerPaletteSkill[];
  bars: PlayerPaletteBar[];
  additional: PlayerPaletteSkill[];
}

const FIREBRAND_BARS = [
  { key: 'justice', label: 'Tome of Justice', ids: [41258, 40635, 42449, 40015, 42898] },
  { key: 'resolve', label: 'Tome of Resolve', ids: [45022, 40679, 45128, 42008, 42925] },
  { key: 'courage', label: 'Tome of Courage', ids: [42986, 41968, 41836, 40988, 44455] },
] as const;

export function supplementalPlayerSkillIds(profession?: string): number[] {
  if (profession === 'Firebrand') return [...FIREBRAND_TOME_ACTIVATION_SKILL_IDS];
  if (profession === 'Druid') return [31869, ...DRUID_CELESTIAL_AVATAR_SKILL_IDS];
  return [];
}

function slotNumber(skill?: Gw2Skill): number | null {
  const match = /^Weapon_([1-5])$/.exec(skill?.slot ?? '');
  return match ? Number(match[1]) : null;
}

function castSummary(casts: RotationCast[], id: number, timeMs: number) {
  const times = [...new Set(casts.filter((cast) => cast.skillId === id && Number.isFinite(cast.castTime) && cast.castTime >= 0).map((cast) => cast.castTime))].sort((a, b) => a - b);
  return { uses: times.length, lastUseMs: times.filter((time) => time <= timeMs).at(-1) ?? null };
}

function rank(left: PlayerPaletteSkill, right: PlayerPaletteSkill): number {
  return (right.lastUseMs ?? -1) - (left.lastUseMs ?? -1) || right.uses - left.uses || left.id - right.id;
}

export function buildPlayerSkillPalette(
  profession: string | undefined,
  casts: RotationCast[],
  references: Record<number, Gw2Skill>,
  timeMs: number,
  focusSkillId?: number,
): PlayerSkillPalette {
  const observedIds = [...new Set(casts.map((cast) => cast.skillId).filter((id) => Number.isSafeInteger(id) && id > 0))];
  const wikiSkills = profession === 'Firebrand' ? firebrandTomeSkills() : [];
  const wikiById = new Map(wikiSkills.map((skill) => [skill.id, skill]));
  const item = (id: number, source?: SkillReferenceSource): PlayerPaletteSkill => ({
    id,
    skill: wikiById.get(id) ?? references[id],
    source: source ?? (wikiById.has(id) ? 'wiki-wvw' : references[id] ? 'api' : 'recorded'),
    ...castSummary(casts, id, timeMs),
  });

  const observed = observedIds.map((id) => item(id));
  const heal = observed.filter(({ skill }) => skill?.slot === 'Heal').sort(rank)[0] ?? null;
  const utilities = observed.filter(({ skill }) => skill?.slot === 'Utility').sort(rank).slice(0, 3);
  const elite = observed.filter(({ skill }) => skill?.slot === 'Elite').sort(rank)[0] ?? null;
  const utilitySlots = [heal, ...Array.from({ length: 3 }, (_, index) => utilities[index] ?? null), elite];

  const mechanicIds = profession === 'Firebrand' ? [...FIREBRAND_TOME_ACTIVATION_SKILL_IDS]
    : profession === 'Druid' ? [31869]
      : observed.filter(({ skill }) => skill?.type === 'Profession' || skill?.slot?.startsWith('Profession')).map(({ id }) => id);
  const mechanics = mechanicIds.map((id) => item(id, references[id] ? 'api' : undefined));

  const alternateIds = new Set<number>();
  const bars: PlayerPaletteBar[] = [];
  const baseSlots = Array.from({ length: 5 }, (_, index) => observed
    .filter(({ skill }) => slotNumber(skill) === index + 1 && !wikiById.has(skill!.id) && !skill?.categories?.includes('CelestialAvatar'))
    .sort(rank)[0] ?? null);
  baseSlots.forEach((entry) => entry && alternateIds.add(entry.id));
  bars.push({ key: 'weapon', label: 'Observed weapon bar', source: 'api', slots: baseSlots });

  if (profession === 'Firebrand') {
    for (const bar of FIREBRAND_BARS) {
      const slots = bar.ids.map((id) => item(id, 'wiki-wvw'));
      slots.forEach((entry) => alternateIds.add(entry.id));
      bars.push({ key: bar.key, label: bar.label, source: 'wiki-wvw', slots });
    }
  }
  if (profession === 'Druid') {
    const slots = DRUID_CELESTIAL_AVATAR_SKILL_IDS.map((id) => item(id, references[id] ? 'api' : 'recorded'));
    slots.forEach((entry) => alternateIds.add(entry.id));
    bars.push({ key: 'celestial-avatar', label: 'Celestial Avatar', source: 'api', slots });
  }

  const placed = new Set([...utilitySlots, ...mechanics, ...alternateIds].flatMap((entry) => typeof entry === 'number' ? [entry] : entry ? [entry.id] : []));
  const additional = observed.filter(({ id }) => !placed.has(id)).sort(rank);
  const focusedId = Number.isSafeInteger(focusSkillId) && focusSkillId! > 0 ? focusSkillId : undefined;
  if (focusedId && !placed.has(focusedId) && !additional.some(({ id }) => id === focusedId)) {
    additional.unshift(item(focusedId, references[focusedId] ? 'api' : 'documented'));
  }
  return { utilitySlots, mechanics, bars, additional };
}
