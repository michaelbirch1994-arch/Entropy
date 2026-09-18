import type { EntropyBuilderState, Gw2Item, Gw2ItemStat, Gw2Legend, Gw2Profession } from "../../types/buildEditor";
import { computeAttributeProfile } from "../gw2/computeAttributes";
import { fetchGw2Items, fetchGw2ItemStats, fetchGw2Legends, fetchGw2Professions } from "../gw2/gw2Api";
import { importGw2SkillsBuild, type Gw2SkillsImportResult } from "../gw2/gw2SkillsImport";
import { normalizeBuilderForEffectivePower, type NormalizedDamageBuild } from "./normalizedBuild";

export interface EffectivePowerImportDependencies {
  importGw2SkillsBuild: (
    input: string,
    options: { itemStatNames: string[]; legends: Gw2Legend[] },
  ) => Promise<Gw2SkillsImportResult>;
  fetchItemStats: () => Promise<Gw2ItemStat[]>;
  fetchLegends: () => Promise<Gw2Legend[]>;
  fetchProfessions: () => Promise<Gw2Profession[]>;
  fetchItems: (ids: number[]) => Promise<Gw2Item[]>;
  now: () => string;
}

const defaultDependencies: EffectivePowerImportDependencies = {
  importGw2SkillsBuild,
  fetchItemStats: fetchGw2ItemStats,
  fetchLegends: fetchGw2Legends,
  fetchProfessions: fetchGw2Professions,
  fetchItems: fetchGw2Items,
  now: () => new Date().toISOString(),
};

function numericEquipmentValues(builder: EntropyBuilderState): number[] {
  const values = [
    builder.equipment.enrichment,
    ...Object.values(builder.equipment.infusions).flatMap((value) => Array.isArray(value) ? value : [value]),
  ];
  return [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value > 0))];
}

export async function importGw2SkillsForEffectivePower(
  input: string,
  dependencies: EffectivePowerImportDependencies = defaultDependencies,
): Promise<NormalizedDamageBuild> {
  const [itemStats, legends, professions] = await Promise.all([
    dependencies.fetchItemStats(),
    dependencies.fetchLegends(),
    dependencies.fetchProfessions(),
  ]);
  const imported = await dependencies.importGw2SkillsBuild(input, {
    itemStatNames: itemStats.map((stat) => stat.name),
    legends,
  });
  const profession = professions.find((entry) => entry.id === imported.state.professionId) ?? null;
  const itemRecords = await dependencies.fetchItems(numericEquipmentValues(imported.state));
  const items = Object.fromEntries(itemRecords.map((item) => [item.id, item]));
  const profile = computeAttributeProfile(imported.state, profession, items);
  const warnings = [...imported.warnings];
  if (!profession) warnings.push(`The official API did not return profession metadata for ${imported.state.professionId}.`);
  if (imported.state.gameMode === "pvp") {
    warnings.push("PvP imports use the WvW Fury rule in Effective Power until a separate PvP ruleset is modeled.");
  }

  return normalizeBuilderForEffectivePower(imported.state, profile, {
    source: {
      kind: "gw2skills",
      label: "gw2skills.net",
      url: imported.sourceUrl,
      importedAt: dependencies.now(),
      warnings,
    },
  });
}
