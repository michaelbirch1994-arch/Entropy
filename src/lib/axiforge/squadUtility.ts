import type { EntropyBuilderState } from "../../types/buildEditor";
import { fetchBuildCombatKit } from "./buildCombatKit";
import { analyzeBuildUtility, type BuildUtilityEntry } from "./utilityEngine";

export async function computeBuildUtilityCoverage(state: EntropyBuilderState): Promise<BuildUtilityEntry[]> {
  const kit = await fetchBuildCombatKit(state);
  return analyzeBuildUtility(kit.skills, kit.traits);
}
