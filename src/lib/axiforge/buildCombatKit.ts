import type {
  EntropyBuilderState,
  Gw2Legend,
  Gw2Pet,
  Gw2Profession,
  Gw2Skill,
  Gw2Specialization,
  Gw2Trait,
} from "../../types/buildEditor";
import {
  fetchGw2Legends,
  fetchGw2Pets,
  fetchGw2Professions,
  fetchGw2Skills,
  fetchGw2Specializations,
  fetchGw2Traits,
} from "../gw2/gw2Api";
import { resolveProfessionMechanicSlots } from "../gw2/professionMechanics";
import { resolveWeaponSkillSlots, weaponSkillIds } from "../gw2/weaponSkillBar";
import { resolveNestedMechanicSkills } from "./nestedMechanicSkills";

export interface BuildCombatKit {
  profession: Gw2Profession | null;
  skills: Gw2Skill[];
  traits: Gw2Trait[];
}

export function resolveSelectedTraits(
  state: EntropyBuilderState,
  specializations: Gw2Specialization[],
  traits: Gw2Trait[],
): Gw2Trait[] {
  const specsById = new Map(specializations.map((specialization) => [specialization.id, specialization]));
  const traitsById = new Map(traits.map((trait) => [trait.id, trait]));
  const majorsBySpec = new Map<number, Gw2Trait[]>();
  for (const trait of traits.filter((item) => item.slot === "Major")) {
    const list = majorsBySpec.get(trait.specialization) ?? [];
    list.push(trait);
    majorsBySpec.set(trait.specialization, list);
  }

  const selectedIds = new Set<number>();
  state.specializationIds.forEach((specId, trackIndex) => {
    const specialization = specId ? specsById.get(specId) : null;
    if (!specialization) return;
    specialization.minor_traits.forEach((id) => selectedIds.add(id));
    for (const tier of [1, 2, 3] as const) {
      const tierTraits = (majorsBySpec.get(specialization.id) ?? [])
        .filter((trait) => trait.tier === tier)
        .sort((left, right) => left.order - right.order);
      const choice = state.traitChoices[trackIndex][tier - 1];
      const selected = choice ? tierTraits[choice - 1] : null;
      if (selected) selectedIds.add(selected.id);
    }
  });
  return [...selectedIds].map((id) => traitsById.get(id)).filter((trait): trait is Gw2Trait => Boolean(trait));
}

export function resolveBuildCombatSkillIds(
  state: EntropyBuilderState,
  profession: Gw2Profession | null,
  specializations: Gw2Specialization[],
  skillsById: Map<number, Gw2Skill>,
  legends: Gw2Legend[] = [],
  pets: Gw2Pet[] = [],
): number[] {
  const ids = new Set<number>([
    state.healSkillId,
    ...state.utilitySkillIds,
    state.eliteSkillId,
  ].filter((id): id is number => Boolean(id)));
  const specsById = new Map(specializations.map((specialization) => [specialization.id, specialization]));

  for (const weaponSet of [1, 2] as const) {
    resolveWeaponSkillSlots(state, profession, weaponSet, skillsById).forEach((reference) => {
      if (reference?.id) ids.add(reference.id);
    });
  }
  resolveProfessionMechanicSlots(state, profession, specsById, skillsById).forEach(({ skill }) => ids.add(skill.id));

  if (state.professionId === "Revenant") {
    const selectedLegends = new Set(state.selectedLegends.filter(Boolean));
    legends.filter((legend) => selectedLegends.has(legend.id)).forEach((legend) => {
      [legend.swap, legend.heal, ...(legend.utilities ?? []), legend.elite]
        .filter((id): id is number => Boolean(id))
        .forEach((id) => ids.add(id));
    });
  }

  if (state.professionId === "Ranger") {
    const selectedPets = new Set([state.selectedPets.terrestrial1, state.selectedPets.terrestrial2].filter(Boolean));
    pets.filter((pet) => selectedPets.has(pet.id)).forEach((pet) => {
      (pet.skills ?? []).forEach(({ id }) => { if (id) ids.add(id); });
    });
  }
  return [...ids];
}

export async function fetchBuildCombatKit(state: EntropyBuilderState): Promise<BuildCombatKit> {
  const specIds = state.specializationIds.filter((id): id is number => Boolean(id));
  const [professions, specializations] = await Promise.all([
    fetchGw2Professions(),
    fetchGw2Specializations(specIds),
  ]);
  const profession = professions.find((item) => item.id === state.professionId) ?? null;
  const traitIds = specializations.flatMap((specialization) => [
    ...specialization.minor_traits,
    ...specialization.major_traits,
  ]);
  const [traits, legends, pets] = await Promise.all([
    fetchGw2Traits(traitIds),
    state.professionId === "Revenant" ? fetchGw2Legends() : Promise.resolve([]),
    state.professionId === "Ranger" ? fetchGw2Pets() : Promise.resolve([]),
  ]);

  const selectedLegendIds = new Set(state.selectedLegends.filter(Boolean));
  const legendSkillIds = legends
    .filter((legend) => selectedLegendIds.has(legend.id))
    .flatMap((legend) => [legend.swap, legend.heal, ...(legend.utilities ?? []), legend.elite])
    .filter((id): id is number => Boolean(id));
  const selectedPetIds = new Set([state.selectedPets.terrestrial1, state.selectedPets.terrestrial2].filter(Boolean));
  const petSkillIds = pets
    .filter((pet) => selectedPetIds.has(pet.id))
    .flatMap((pet) => pet.skills?.map(({ id }) => id) ?? []);
  const candidateSkillIds = [
    state.healSkillId,
    ...state.utilitySkillIds,
    state.eliteSkillId,
    ...(profession?.skills.map(({ id }) => id) ?? []),
    ...weaponSkillIds(profession),
    ...legendSkillIds,
    ...petSkillIds,
  ].filter((id): id is number => Boolean(id));
  const skillCatalog = await fetchGw2Skills(candidateSkillIds);
  const skillsById = new Map(skillCatalog.map((skill) => [skill.id, skill]));
  const activeSkillIds = resolveBuildCombatSkillIds(state, profession, specializations, skillsById, legends, pets);
  const nestedMechanicSkills = resolveNestedMechanicSkills(state);
  const activeSkills = activeSkillIds
    .map((id) => skillsById.get(id))
    .filter((skill): skill is Gw2Skill => Boolean(skill));
  const uniqueSkills = new Map([...activeSkills, ...nestedMechanicSkills].map((skill) => [skill.id, skill]));

  return {
    profession,
    skills: [...uniqueSkills.values()],
    traits: resolveSelectedTraits(state, specializations, traits),
  };
}
