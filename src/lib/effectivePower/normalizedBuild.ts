import type { EntropyBuilderState } from "../../types/buildEditor";
import type { AttributeProfile, AttributeTotals } from "../gw2/computeAttributes";
import type { EffectivePowerGameMode, EffectivePowerInput } from "./effectivePower";

export const NORMALIZED_DAMAGE_BUILD_SCHEMA = "entropy.normalized-damage-build.v1" as const;

export type NormalizedBuildSourceKind = "manual" | "gw2skills" | "entropy-builder";

export interface NormalizedBuildSource {
  kind: NormalizedBuildSourceKind;
  label: string;
  url?: string;
  importedAt: string;
  warnings: string[];
}

export interface NormalizedDamageBuild {
  schema: typeof NORMALIZED_DAMAGE_BUILD_SCHEMA;
  name: string;
  gameMode: EntropyBuilderState["gameMode"];
  professionId: string;
  source: NormalizedBuildSource;
  specializations: {
    ids: EntropyBuilderState["specializationIds"];
    traitChoices: EntropyBuilderState["traitChoices"];
  };
  skills: {
    heal: number | null;
    utility: EntropyBuilderState["utilitySkillIds"];
    elite: number | null;
  };
  equipment: EntropyBuilderState["equipment"];
  attributes: AttributeTotals & {
    equippedSlots: number;
    totalSlots: number;
    provenance: "entropy-wiki-equipment-model+gw2-api-items";
  };
  modifiers: {
    bonusCriticalChancePercent: number;
    bonusCriticalDamagePercent: number;
    strikeDamageModifierPercent: number;
  };
}

export type EffectivePowerCombatAssumptions = Pick<
  EffectivePowerInput,
  "furyUptimePercent" | "mightStacks" | "mightUptimePercent" | "vulnerabilityStacks"
>;

interface NormalizeBuilderOptions {
  source: Omit<NormalizedBuildSource, "warnings"> & { warnings?: string[] };
}

function cloneEquipment(equipment: EntropyBuilderState["equipment"]): EntropyBuilderState["equipment"] {
  return {
    ...equipment,
    slots: { ...equipment.slots },
    weapons: { ...equipment.weapons },
    runes: { ...equipment.runes },
    sigils: Object.fromEntries(Object.entries(equipment.sigils).map(([slot, ids]) => [slot, [...ids]])) as EntropyBuilderState["equipment"]["sigils"],
    infusions: Object.fromEntries(Object.entries(equipment.infusions).map(([slot, value]) => [slot, Array.isArray(value) ? [...value] : value])),
  };
}

export function normalizeBuilderForEffectivePower(
  builder: EntropyBuilderState,
  profile: AttributeProfile,
  options: NormalizeBuilderOptions,
): NormalizedDamageBuild {
  const warnings = [...(options.source.warnings ?? [])];
  if (profile.equippedSlots < profile.totalSlots) {
    warnings.push(`Only ${profile.equippedSlots} of ${profile.totalSlots} modeled equipment slots were resolved.`);
  }
  warnings.push("Trait, sigil-proc, and conditional damage modifiers are not inferred; review the manual modifier fields.");

  return {
    schema: NORMALIZED_DAMAGE_BUILD_SCHEMA,
    name: builder.name,
    gameMode: builder.gameMode,
    professionId: builder.professionId,
    source: { ...options.source, warnings: [...new Set(warnings)] },
    specializations: {
      ids: [...builder.specializationIds],
      traitChoices: builder.traitChoices.map((row) => [...row]) as EntropyBuilderState["traitChoices"],
    },
    skills: {
      heal: builder.healSkillId,
      utility: [...builder.utilitySkillIds],
      elite: builder.eliteSkillId,
    },
    equipment: cloneEquipment(builder.equipment),
    attributes: {
      ...profile.totals,
      equippedSlots: profile.equippedSlots,
      totalSlots: profile.totalSlots,
      provenance: "entropy-wiki-equipment-model+gw2-api-items",
    },
    modifiers: {
      bonusCriticalChancePercent: 0,
      bonusCriticalDamagePercent: 0,
      strikeDamageModifierPercent: 0,
    },
  };
}

export function effectivePowerGameMode(gameMode: NormalizedDamageBuild["gameMode"]): EffectivePowerGameMode {
  return gameMode === "pve" ? "pve" : "wvw";
}

export function effectivePowerInputFromNormalizedBuild(
  build: NormalizedDamageBuild,
  assumptions: EffectivePowerCombatAssumptions,
): EffectivePowerInput {
  return {
    power: build.attributes.power,
    precision: build.attributes.precision,
    ferocity: build.attributes.ferocity,
    gameMode: effectivePowerGameMode(build.gameMode),
    ...assumptions,
    ...build.modifiers,
  };
}
