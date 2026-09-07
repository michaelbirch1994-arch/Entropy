import type { EntropyBuilderState, SavedBuilderBuild } from "../../types/buildEditor";
import { analyzeBuildBoons, type BoonCoverageEntry } from "./boonEngine";
import { computeAttributeTotals } from "../gw2/computeAttributes";
import { fetchBuildCombatKit } from "./buildCombatKit";

function coverageRevision(state: EntropyBuilderState): string {
  const value = JSON.stringify({
    professionId: state.professionId,
    specializationIds: state.specializationIds,
    traitChoices: state.traitChoices,
    healSkillId: state.healSkillId,
    utilitySkillIds: state.utilitySkillIds,
    eliteSkillId: state.eliteSkillId,
    selectedLegends: state.selectedLegends,
    selectedPets: state.selectedPets,
    activeAttunement: state.activeAttunement,
    activeAttunement2: state.activeAttunement2,
    equipment: state.equipment,
  });
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function mergeLiveBuildForCoverage(
  builds: SavedBuilderBuild[],
  editingBuildId: string | null,
  draft: EntropyBuilderState,
): SavedBuilderBuild[] {
  if (!editingBuildId || !builds.some((build) => build.id === editingBuildId)) return builds;
  return builds.map((build) => build.id === editingBuildId
    ? {
        ...build,
        name: draft.name.trim() || build.name,
        state: draft,
        updatedAt: `${build.updatedAt}:draft:${coverageRevision(draft)}`,
      }
    : build);
}

/**
 * Resolve the live GW2 API data a build actually uses right now - its chosen
 * major trait per tier plus every auto-granted minor trait across its three
 * specialization lines, both weapon sets, slot skills, pets, legends, direct
 * profession mechanics, and curated nested mechanics - then run that through
 * the boon-coverage engine.
 */
export async function computeBuildBoonCoverage(state: EntropyBuilderState): Promise<BoonCoverageEntry[]> {
  const kit = await fetchBuildCombatKit(state);
  const boonDurationPercent = computeAttributeTotals(state, kit.profession).boonDuration;
  return analyzeBuildBoons(kit.skills, kit.traits, boonDurationPercent, state.gameMode);
}
