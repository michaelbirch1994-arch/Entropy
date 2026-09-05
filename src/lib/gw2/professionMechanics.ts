import type { EntropyBuilderState, Gw2Pet, Gw2Profession, Gw2Skill, Gw2Specialization } from "../../types/buildEditor";

export interface ProfessionMechanicSlot {
  key: `F${number}`;
  skill: Gw2Skill;
}

export interface RangerPetSlot {
  key: "P1" | "P2";
  pet: Gw2Pet | null;
}

const HIDDEN_MECHANIC_NAME = /^(?:exit|leave|stow)\b/i;
const PROFESSION_SLOT = /^Profession_([1-5])$/;
const DERIVED_MECHANIC_PROFESSIONS = new Set(["Engineer", "Ranger", "Revenant", "Warrior"]);

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
