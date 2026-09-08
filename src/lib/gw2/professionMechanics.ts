import type { EntropyBuilderState, Gw2Legend, Gw2Pet, Gw2Profession, Gw2Skill, Gw2Specialization } from "../../types/buildEditor";

export interface ProfessionMechanicSlot {
  key: `F${number}`;
  skill: Gw2Skill;
}

export interface RangerPetSlot {
  key: "P1" | "P2";
  pet: Gw2Pet | null;
}

export interface RevenantLegendSlot {
  key: "L1" | "L2";
  legend: Gw2Legend | null;
  skill: Gw2Skill | null;
}

const HIDDEN_MECHANIC_NAME = /^(?:exit|leave|locked|stow)\b/i;
const PROFESSION_SLOT = /^Profession_([1-5])$/;
const DERIVED_MECHANIC_PROFESSIONS = new Set(["Ranger", "Revenant", "Warrior"]);
const BERSERKER_SPECIALIZATION_ID = 18;
const SPELLBREAKER_SPECIALIZATION_ID = 61;
const BLADESWORN_SPECIALIZATION_ID = 68;
const PARAGON_SPECIALIZATION_ID = 74;

/**
 * Resolve only mechanic buttons explicitly identified by the profession API.
 * Derived mechanics need additional state and are intentionally not guessed.
 */
export function resolveProfessionMechanicSlots(
  builder: EntropyBuilderState,
  profession: Gw2Profession | null,
  specsById: Map<number, Gw2Specialization>,
  skillsById: Map<number, Gw2Skill>,
): ProfessionMechanicSlot[] {
  if (!profession || DERIVED_MECHANIC_PROFESSIONS.has(profession.id)) return [];

  const activeEliteSpecIds = new Set(
    builder.specializationIds.filter(
      (id): id is number => id !== null && Boolean(specsById.get(id)?.elite),
    ),
  );
  if (profession.id === "Elementalist" && activeEliteSpecIds.size) return [];
  const candidates = profession.skills
    .map((reference) => {
      const match = PROFESSION_SLOT.exec(reference.slot);
      const skill = skillsById.get(reference.id);
      return match && skill && !HIDDEN_MECHANIC_NAME.test(skill.name)
        ? { slot: Number(match[1]), skill }
        : null;
    })
    .filter((entry): entry is { slot: number; skill: Gw2Skill } => Boolean(entry))
    .filter(({ slot }) => profession.id !== "Thief" || activeEliteSpecIds.size > 0 || slot === 1)
    .filter(({ skill }) => activeEliteSpecIds.size
      ? Boolean(skill.specialization && activeEliteSpecIds.has(skill.specialization))
      : !skill.specialization);

  const bySlot = new Map<number, Gw2Skill>();
  for (const { slot, skill } of candidates) {
    const current = bySlot.get(slot);
    if (!current || (!current.flip_skill && skill.flip_skill)) bySlot.set(slot, skill);
  }

  return [...bySlot.entries()]
    .sort(([left], [right]) => left - right)
    .map(([slot, skill]) => ({ key: `F${slot}` as `F${number}`, skill }));
}

export function resolveRangerPetSlots(
  builder: EntropyBuilderState,
  pets: Gw2Pet[],
): RangerPetSlot[] {
  if (builder.professionId !== "Ranger") return [];
  const petsById = new Map(pets.map((pet) => [pet.id, pet]));
  return [builder.selectedPets.terrestrial1, builder.selectedPets.terrestrial2].map((id, index) => ({
    key: index === 0 ? "P1" : "P2",
    pet: id ? petsById.get(id) ?? null : null,
  }));
}

export function resolveWarriorMechanicSkills(
  builder: EntropyBuilderState,
  profession: Gw2Profession | null,
  skillsById: Map<number, Gw2Skill>,
): Gw2Skill[] {
  if (builder.professionId !== "Warrior" || profession?.id !== "Warrior") return [];

  const activeSpecializations = new Set(builder.specializationIds.filter((id): id is number => id != null));
  const activeEliteId = [BERSERKER_SPECIALIZATION_ID, SPELLBREAKER_SPECIALIZATION_ID, BLADESWORN_SPECIALIZATION_ID, PARAGON_SPECIALIZATION_ID]
    .find((id) => activeSpecializations.has(id));
  const terrestrialWeapons = new Set([
    builder.equipment.weapons.mainhand1,
    builder.equipment.weapons.mainhand2,
  ].filter(Boolean).map((weapon) => weapon.toLowerCase()));
  const professionSkills = profession.skills
    .map(({ id }) => skillsById.get(id))
    .filter((skill): skill is Gw2Skill => skill != null && !HIDDEN_MECHANIC_NAME.test(skill.name));

  const weaponSpec = activeEliteId === BERSERKER_SPECIALIZATION_ID || activeEliteId === SPELLBREAKER_SPECIALIZATION_ID
    ? activeEliteId
    : null;
  const weaponBursts = professionSkills.filter((skill) => (
    skill.slot === "Profession_1"
    && Boolean(skill.weapon_type && terrestrialWeapons.has(skill.weapon_type.toLowerCase()))
    && (weaponSpec ? skill.specialization === weaponSpec : !skill.specialization)
    && !skill.flags?.includes("Underwater")
  ));

  const directMechanics = professionSkills.filter((skill) => {
    if (!activeEliteId || skill.specialization !== activeEliteId || skill.weapon_type !== "None") return false;
    if (activeEliteId === BERSERKER_SPECIALIZATION_ID) return skill.name === "Berserk";
    if (activeEliteId === SPELLBREAKER_SPECIALIZATION_ID) return skill.name === "Full Counter";
    return activeEliteId === BLADESWORN_SPECIALIZATION_ID || activeEliteId === PARAGON_SPECIALIZATION_ID;
  });
  const preferredDirectMechanics = activeEliteId === BERSERKER_SPECIALIZATION_ID
    ? directMechanics.sort((left, right) => {
      const leftRecharge = left.facts?.find(({ type }) => type === "Recharge")?.value ?? 0;
      const rightRecharge = right.facts?.find(({ type }) => type === "Recharge")?.value ?? 0;
      return builder.gameMode === "pve" ? leftRecharge - rightRecharge : rightRecharge - leftRecharge;
    }).slice(0, 1)
    : directMechanics;

  const uniqueSkills = new Map<string, Gw2Skill>();
  for (const skill of [...weaponBursts, ...preferredDirectMechanics]) {
    const key = `${skill.slot}:${skill.weapon_type ?? "None"}:${skill.name}`;
    if (!uniqueSkills.has(key)) uniqueSkills.set(key, skill);
  }
  return [...uniqueSkills.values()];
}

export function availableRevenantLegends(
  legends: Gw2Legend[],
  specializationIds: Array<number | null>,
  skillsById: Map<number, Gw2Skill>,
): Gw2Legend[] {
  const activeSpecializations = new Set(specializationIds.filter((id): id is number => id != null));
  return legends.filter((legend) => {
    const swapSkill = legend.swap ? skillsById.get(legend.swap) : null;
    return !swapSkill?.specialization || activeSpecializations.has(swapSkill.specialization);
  });
}

export function resolveRevenantLegendSlots(
  builder: EntropyBuilderState,
  legends: Gw2Legend[],
  skillsById: Map<number, Gw2Skill>,
): RevenantLegendSlot[] {
  if (builder.professionId !== "Revenant") return [];
  const legendsById = new Map(legends.map((legend) => [legend.id, legend]));
  return builder.selectedLegends.map((id, index) => {
    const legend = id ? legendsById.get(id) ?? null : null;
    return {
      key: index === 0 ? "L1" : "L2",
      legend,
      skill: legend?.swap ? skillsById.get(legend.swap) ?? null : null,
    };
  });
}

export function validateRevenantLegendSelection(
  builder: EntropyBuilderState,
  legends: Gw2Legend[],
  skillsById: Map<number, Gw2Skill>,
): string[] {
  if (builder.professionId !== "Revenant") return [];
  const availableIds = new Set(availableRevenantLegends(legends, builder.specializationIds, skillsById).map((legend) => legend.id));
  const legendsById = new Map(legends.map((legend) => [legend.id, legend]));
  return [...new Set(builder.selectedLegends.flatMap((id) => {
    const legend = legendsById.get(id);
    const swapSkill = legend?.swap ? skillsById.get(legend.swap) : null;
    return legend && swapSkill && !availableIds.has(id)
      ? [`${swapSkill.name} is not available to the selected specializations.`]
      : [];
  }))];
}
