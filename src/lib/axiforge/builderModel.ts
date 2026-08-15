import type {
  BuilderComposition,
  BuilderEquipment,
  BuilderParty,
  BuilderTraitRow,
  EntropyBuilderState,
  Gw2Skill,
  Gw2Specialization,
  Gw2Trait,
  SavedBuilderBuild,
} from "../../types/buildEditor";

export const BUILDER_STORAGE_KEY = "entropy.builder.workspace.v1";

export const WEAPON_OPTIONS = [
  "", "axe", "dagger", "mace", "pistol", "sword", "scepter", "focus", "shield", "torch", "warhorn",
  "greatsword", "hammer", "longbow", "rifle", "shortbow", "staff", "harpoon", "spear", "trident",
] as const;

export const STAT_OPTIONS = [
  "", "Berserker's", "Marauder's", "Assassin's", "Valkyrie", "Dragon's", "Viper's", "Grieving", "Sinister",
  "Dire", "Rabid", "Carrion", "Trailblazer's", "Knight's", "Soldier's", "Cleric's", "Minstrel's", "Harrier's",
  "Ritualist's", "Seraph", "Zealot's", "Celestial",
] as const;

export const ARMOR_SLOTS = ["head", "shoulders", "chest", "hands", "legs", "feet"] as const;
export const WEAPON_SLOTS = ["mainhand1", "offhand1", "mainhand2", "offhand2"] as const;

const emptyTraitRow = (): BuilderTraitRow => [0, 0, 0];

export function createEmptyEquipment(): BuilderEquipment {
  return {
    statPackage: "",
    slots: {},
    weapons: { mainhand1: "", offhand1: "", mainhand2: "", offhand2: "", aquatic1: "", aquatic2: "" },
    runes: { head: "", shoulders: "", chest: "", hands: "", legs: "", feet: "" },
    sigils: { mainhand1: [], offhand1: [], mainhand2: [], offhand2: [], aquatic1: [], aquatic2: [] },
    infusions: {},
    relic: "",
    food: "",
    utility: "",
    enrichment: "",
  };
}

export function createEmptyBuilder(professionId = "Guardian"): EntropyBuilderState {
  return {
    name: "Untitled WvW Build",
    role: "",
    tags: [],
    notes: "",
    professionId,
    gameMode: "wvw",
    specializationIds: [null, null, null],
    traitChoices: [emptyTraitRow(), emptyTraitRow(), emptyTraitRow()],
    healSkillId: null,
    utilitySkillIds: [null, null, null],
    eliteSkillId: null,
    underwaterSkills: { healSkillId: null, utilitySkillIds: [null, null, null], eliteSkillId: null },
    equipment: createEmptyEquipment(),
    selectedLegends: ["", ""],
    selectedUnderwaterLegends: ["", ""],
    selectedPets: { terrestrial1: 0, terrestrial2: 0, aquatic1: 0, aquatic2: 0 },
    activeAttunement: "",
    activeAttunement2: "",
    activeKit: 0,
    activeWeaponSet: 1,
    allianceTacticsForm: 0,
    antiquaryArtifacts: { f2: 0, f3: 0, f4: 0 },
  };
}

export function normalizeBuilderState(value: unknown): EntropyBuilderState {
  const base = createEmptyBuilder();
  if (!value || typeof value !== "object") return base;
  const input = value as Partial<EntropyBuilderState>;
  const equipment = input.equipment ?? base.equipment;
  const traitChoices = Array.isArray(input.traitChoices) && input.traitChoices.length === 3
    ? input.traitChoices.map((row) => traitRow(row)) as EntropyBuilderState["traitChoices"]
    : base.traitChoices;
  return {
    ...base,
    ...input,
    name: typeof input.name === "string" ? input.name : base.name,
    role: typeof input.role === "string" ? input.role : "",
    tags: Array.isArray(input.tags) ? input.tags.filter((tag): tag is string => typeof tag === "string") : [],
    notes: typeof input.notes === "string" ? input.notes : "",
    specializationIds: Array.isArray(input.specializationIds) ? numberTuple(input.specializationIds) : base.specializationIds,
    traitChoices,
    utilitySkillIds: Array.isArray(input.utilitySkillIds) ? numberTuple(input.utilitySkillIds) : base.utilitySkillIds,
    underwaterSkills: {
      ...base.underwaterSkills,
      ...(input.underwaterSkills ?? {}),
      utilitySkillIds: Array.isArray(input.underwaterSkills?.utilitySkillIds) ? numberTuple(input.underwaterSkills.utilitySkillIds) : base.underwaterSkills.utilitySkillIds,
    },
    equipment: {
      ...base.equipment,
      ...equipment,
      slots: { ...base.equipment.slots, ...(equipment.slots ?? {}) },
      weapons: { ...base.equipment.weapons, ...(equipment.weapons ?? {}) },
      runes: { ...base.equipment.runes, ...(equipment.runes ?? {}) },
      sigils: { ...base.equipment.sigils, ...(equipment.sigils ?? {}) },
      infusions: { ...base.equipment.infusions, ...(equipment.infusions ?? {}) },
    },
    selectedLegends: Array.isArray(input.selectedLegends) ? [input.selectedLegends[0] ?? "", input.selectedLegends[1] ?? ""] : base.selectedLegends,
    selectedUnderwaterLegends: Array.isArray(input.selectedUnderwaterLegends) ? [input.selectedUnderwaterLegends[0] ?? "", input.selectedUnderwaterLegends[1] ?? ""] : base.selectedUnderwaterLegends,
    selectedPets: { ...base.selectedPets, ...(input.selectedPets ?? {}) },
    antiquaryArtifacts: { ...base.antiquaryArtifacts, ...(input.antiquaryArtifacts ?? {}) },
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableNumber(value: unknown): number | null {
  const parsed = numberValue(value, 0);
  return parsed > 0 ? parsed : null;
}

function numberTuple(value: unknown): [number | null, number | null, number | null] {
  const values = Array.isArray(value) ? value : [];
  return [nullableNumber(values[0]), nullableNumber(values[1]), nullableNumber(values[2])];
}

function traitRow(value: unknown): BuilderTraitRow {
  const values = Array.isArray(value) ? value : [];
  return [0, 1, 2].map((index) => Math.max(0, Math.min(3, numberValue(values[index], 0)))) as BuilderTraitRow;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(Object.entries(asRecord(value)).map(([key, item]) => [key, stringValue(item)]));
}

function arrayRecord(value: unknown): Record<string, string[]> {
  return Object.fromEntries(Object.entries(asRecord(value)).map(([key, item]) => [key, stringArray(item)]));
}

function infusionRecord(value: unknown): Record<string, string | string[]> {
  return Object.fromEntries(Object.entries(asRecord(value)).map(([key, item]) => [key, Array.isArray(item) ? stringArray(item) : stringValue(item)]));
}

export function builderFromAxiBuild(value: unknown, metadata?: Partial<EntropyBuilderState>): EntropyBuilderState {
  const decoded = asRecord(value);
  const skills = asRecord(decoded.skills);
  const underwaterSkills = asRecord(decoded.underwaterSkills);
  const equipment = asRecord(decoded.equipment);
  const weapons = asRecord(equipment.weapons);
  const specializations = Array.isArray(decoded.specializations) ? decoded.specializations.map(asRecord) : [];
  const selectedPets = asRecord(decoded.selectedPets);
  const artifacts = asRecord(decoded.antiquaryArtifacts);
  const base = createEmptyBuilder(stringValue(decoded.profession, metadata?.professionId ?? "Guardian"));

  return {
    ...base,
    ...metadata,
    professionId: stringValue(decoded.profession, base.professionId),
    gameMode: decoded.gameMode === "pve" || decoded.gameMode === "pvp" || decoded.gameMode === "wvw" ? decoded.gameMode : base.gameMode,
    specializationIds: [0, 1, 2].map((index) => nullableNumber(specializations[index]?.id)) as EntropyBuilderState["specializationIds"],
    traitChoices: [0, 1, 2].map((index) => traitRow(specializations[index]?.traitChoices)) as EntropyBuilderState["traitChoices"],
    healSkillId: nullableNumber(skills.healId),
    utilitySkillIds: numberTuple(skills.utilityIds),
    eliteSkillId: nullableNumber(skills.eliteId),
    underwaterSkills: {
      healSkillId: nullableNumber(underwaterSkills.healId),
      utilitySkillIds: numberTuple(underwaterSkills.utilityIds),
      eliteSkillId: nullableNumber(underwaterSkills.eliteId),
    },
    equipment: {
      statPackage: stringValue(equipment.statPackage),
      slots: stringRecord(equipment.slots),
      weapons: {
        mainhand1: stringValue(weapons.mainhand1), offhand1: stringValue(weapons.offhand1),
        mainhand2: stringValue(weapons.mainhand2), offhand2: stringValue(weapons.offhand2),
        aquatic1: stringValue(weapons.aquatic1), aquatic2: stringValue(weapons.aquatic2),
      },
      runes: { ...base.equipment.runes, ...stringRecord(equipment.runes) },
      sigils: { ...base.equipment.sigils, ...arrayRecord(equipment.sigils) },
      infusions: infusionRecord(equipment.infusions),
      relic: stringValue(equipment.relic),
      food: stringValue(equipment.food),
      utility: stringValue(equipment.utility),
      enrichment: stringValue(equipment.enrichment),
    },
    selectedLegends: [stringArray(decoded.selectedLegends)[0] ?? "", stringArray(decoded.selectedLegends)[1] ?? ""],
    selectedUnderwaterLegends: [stringArray(decoded.selectedUnderwaterLegends)[0] ?? "", stringArray(decoded.selectedUnderwaterLegends)[1] ?? ""],
    selectedPets: {
      terrestrial1: numberValue(selectedPets.terrestrial1), terrestrial2: numberValue(selectedPets.terrestrial2),
      aquatic1: numberValue(selectedPets.aquatic1), aquatic2: numberValue(selectedPets.aquatic2),
    },
    activeAttunement: stringValue(decoded.activeAttunement),
    activeAttunement2: stringValue(decoded.activeAttunement2),
    activeKit: numberValue(decoded.activeKit),
    activeWeaponSet: numberValue(decoded.activeWeaponSet, 1),
    allianceTacticsForm: numberValue(decoded.allianceTacticsForm),
    antiquaryArtifacts: { f2: numberValue(artifacts.f2), f3: numberValue(artifacts.f3), f4: numberValue(artifacts.f4) },
  };
}

export function buildAxiShape(
  builder: EntropyBuilderState,
  specsById: Map<number, Gw2Specialization>,
  traitsBySpecId: Map<number, Gw2Trait[]>,
  skillsById: Map<number, Gw2Skill>,
) {
  const skill = (id: number | null) => id ? { id, name: skillsById.get(id)?.name } : null;
  return {
    profession: builder.professionId,
    gameMode: builder.gameMode,
    specializations: builder.specializationIds.map((specId, trackIndex) => {
      if (!specId) return { id: 0 };
      const spec = specsById.get(specId);
      const majorTraitsByTier: Record<number, { id: number }[]> = {};
      const majorChoices: Record<number, number | null> = {};
      for (const tier of [1, 2, 3]) {
        const traits = (traitsBySpecId.get(specId) ?? [])
          .filter((trait) => trait.slot === "Major" && trait.tier === tier)
          .sort((a, b) => a.order - b.order);
        majorTraitsByTier[tier] = traits.map((trait) => ({ id: trait.id }));
        majorChoices[tier] = traits[builder.traitChoices[trackIndex][tier - 1] - 1]?.id ?? null;
      }
      return { id: specId, name: spec?.name ?? `Specialization ${specId}`, elite: spec?.elite ?? false, majorTraitsByTier, majorChoices };
    }),
    skills: { heal: skill(builder.healSkillId), utility: builder.utilitySkillIds.map(skill), elite: skill(builder.eliteSkillId) },
    underwaterSkills: {
      heal: skill(builder.underwaterSkills.healSkillId),
      utility: builder.underwaterSkills.utilitySkillIds.map(skill),
      elite: skill(builder.underwaterSkills.eliteSkillId),
    },
    equipment: builder.equipment,
    selectedLegends: builder.selectedLegends,
    selectedUnderwaterLegends: builder.selectedUnderwaterLegends,
    selectedPets: builder.selectedPets,
    activeAttunement: builder.activeAttunement,
    activeAttunement2: builder.activeAttunement2,
    activeKit: builder.activeKit,
    activeWeaponSet: builder.activeWeaponSet,
    allianceTacticsForm: builder.allianceTacticsForm,
    antiquaryArtifacts: builder.antiquaryArtifacts,
  };
}

export function validateBuilder(builder: EntropyBuilderState): string[] {
  const issues: string[] = [];
  if (!builder.name.trim()) issues.push("Add a build name.");
  if (builder.specializationIds.some((id) => !id)) issues.push("Choose all three specialization lines.");
  if (builder.traitChoices.some((row) => row.some((choice) => choice === 0))) issues.push("Choose all nine major traits.");
  if (!builder.healSkillId || builder.utilitySkillIds.some((id) => !id) || !builder.eliteSkillId) issues.push("Complete the land skill bar.");
  if (!builder.equipment.statPackage) issues.push("Choose an equipment stat package.");
  if (!builder.equipment.weapons.mainhand1) issues.push("Choose a primary weapon.");
  return issues;
}

export function createSavedBuild(state: EntropyBuilderState, shareCode: string, existingId?: string): SavedBuilderBuild {
  const now = new Date().toISOString();
  return { id: existingId ?? createBuilderId(), name: state.name.trim() || "Untitled Build", createdAt: now, updatedAt: now, shareCode, state };
}

export function createBuilderId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `builder-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createParty(index: number): BuilderParty {
  return { id: createBuilderId(), name: `Subgroup ${index + 1}`, slots: [null, null, null, null, null] };
}

export function createComposition(name = "WvW Squad"): BuilderComposition {
  const now = new Date().toISOString();
  return { id: createBuilderId(), name, gameMode: "wvw", parties: [createParty(0), createParty(1)], createdAt: now, updatedAt: now };
}

export function cloneBuilder(state: EntropyBuilderState): EntropyBuilderState {
  return structuredClone(state);
}
