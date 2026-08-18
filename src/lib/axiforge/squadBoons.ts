import { fetchGw2Skills, fetchGw2Specializations, fetchGw2Traits } from "../gw2/gw2Api";
import type { EntropyBuilderState } from "../../types/buildEditor";
import { analyzeBuildBoons, type BoonCoverageEntry } from "./boonEngine";

/**
 * Resolve the live GW2 API data a build actually uses right now - its chosen
 * major trait per tier plus every auto-granted minor trait across its three
 * specialization lines, and its heal/utility/elite skills - then run that
 * through the boon-coverage engine. This mirrors the same "sort majors by
 * tier/order, then pick by traitChoices index" trait-resolution logic that
 * buildAxiShape() already uses for AxiCode export.
 */
export async function computeBuildBoonCoverage(state: EntropyBuilderState): Promise<BoonCoverageEntry[]> {
  const specIds = state.specializationIds.filter((id): id is number => Boolean(id));
  if (!specIds.length) return [];

  const specs = await fetchGw2Specializations(specIds);
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

  return analyzeBuildBoons(skills, traits);
}
