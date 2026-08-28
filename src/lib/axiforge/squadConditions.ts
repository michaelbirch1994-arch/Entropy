import { fetchGw2Skills, fetchGw2Specializations, fetchGw2Traits } from "../gw2/gw2Api";
import type { EntropyBuilderState } from "../../types/buildEditor";
import { analyzeBuildConditions, type BuilderConditionEntry } from "./conditionEngine";

export async function computeBuildConditionAccess(state: EntropyBuilderState): Promise<BuilderConditionEntry[]> {
  const specIds = state.specializationIds.filter((id): id is number => Boolean(id));
  const specs = specIds.length ? await fetchGw2Specializations(specIds) : [];
  const specsById = new Map(specs.map((spec) => [spec.id, spec]));

  const minorTraitIds = new Set<number>();
  for (const spec of specs) for (const id of spec.minor_traits) minorTraitIds.add(id);

  const allMajorIds = specs.flatMap((spec) => spec.major_traits);
  const majorTraits = allMajorIds.length ? await fetchGw2Traits(allMajorIds) : [];
  const majorsBySpec = new Map<number, typeof majorTraits>();
  for (const trait of majorTraits) {
    const list = majorsBySpec.get(trait.specialization) ?? [];
    list.push(trait);
    majorsBySpec.set(trait.specialization, list);
  }

  const chosenMajorIds = new Set<number>();
  state.specializationIds.forEach((specId, trackIndex) => {
    if (!specId || !specsById.has(specId)) return;
    for (const tier of [1, 2, 3] as const) {
      const tierTraits = (majorsBySpec.get(specId) ?? [])
        .filter((trait) => trait.tier === tier)
        .sort((a, b) => a.order - b.order);
      const choice = state.traitChoices[trackIndex][tier - 1];
      const chosen = choice ? tierTraits[choice - 1] : null;
      if (chosen) chosenMajorIds.add(chosen.id);
    }
  });

  const traitIds = [...minorTraitIds, ...chosenMajorIds];
  const traits = traitIds.length ? await fetchGw2Traits(traitIds) : [];

  const skillIds = [state.healSkillId, ...state.utilitySkillIds, state.eliteSkillId].filter(
    (id): id is number => Boolean(id),
  );
  const skills = skillIds.length ? await fetchGw2Skills(skillIds) : [];

  return analyzeBuildConditions(skills, traits);
}
