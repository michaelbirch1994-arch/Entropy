import type { EntropyBuilderState } from "../../types/buildEditor";
import { analyzeBuildConditions, type BuilderConditionEntry } from "./conditionEngine";
import { computeAttributeTotals } from "../gw2/computeAttributes";
import { fetchBuildCombatKit } from "./buildCombatKit";

export async function computeBuildConditionAccess(state: EntropyBuilderState): Promise<BuilderConditionEntry[]> {
  const kit = await fetchBuildCombatKit(state);
  const conditionDurationPercent = computeAttributeTotals(state, kit.profession).conditionDuration;
  return analyzeBuildConditions(kit.skills, kit.traits, conditionDurationPercent);
}
