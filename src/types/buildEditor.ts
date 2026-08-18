export type Gw2GameMode = "pve" | "pvp" | "wvw";

export type Gw2SkillSlot = "Heal" | "Utility" | "Elite" | "Profession";

export interface Gw2ApiFact {
  text?: string;
  type?: string;
  icon?: string;
  value?: number;
  percent?: number;
  duration?: number;
  field_type?: string;
  apply_count?: number;
  status?: string;
  description?: string;
}

export interface Gw2ProfessionSkillRef {
  id: number;
  slot: Gw2SkillSlot;
  type?: string;
}

export interface Gw2Profession {
  id: string;
  name: string;
  icon?: string;
  icon_big?: string;
  specializations: number[];
  skills: Gw2ProfessionSkillRef[];
}

export interface Gw2Specialization {
  id: number;
  name: string;
  profession: string;
  elite: boolean;
  icon?: string;
  background?: string;
  major_traits: number[];
  minor_traits: number[];
}

export interface Gw2Trait {
  id: number;
  name: string;
  icon?: string;
  description?: string;
  specialization: number;
  tier: number;
  order: number;
  slot: "Major" | "Minor";
  facts?: Gw2ApiFact[];
}

export interface Gw2Skill {
  id: number;
  name: string;
  icon?: string;
  description?: string;
  type?: string;
  weapon_type?: string;
  professions?: string[];
  slot: Gw2SkillSlot;
  facts?: Gw2ApiFact[];
}

export type BuilderTraitRow = [number, number, number];

export interface BuilderEquipment {
  statPackage: string;
  slots: Record<string, string>;
  weapons: {
    mainhand1: string;
    offhand1: string;
    mainhand2: string;
    offhand2: string;
    aquatic1: string;
    aquatic2: string;
  };
  runes: Record<"head" | "shoulders" | "chest" | "hands" | "legs" | "feet", string>;
  sigils: Record<"mainhand1" | "offhand1" | "mainhand2" | "offhand2" | "aquatic1" | "aquatic2", string[]>;
  infusions: Record<string, string | string[]>;
  relic: string;
  food: string;
  utility: string;
  enrichment: string;
}

export interface EntropyBuilderState {
  name: string;
  role: string;
  tags: string[];
  notes: string;
  professionId: string;
  gameMode: Gw2GameMode;
  specializationIds: [number | null, number | null, number | null];
  traitChoices: [BuilderTraitRow, BuilderTraitRow, BuilderTraitRow];
  healSkillId: number | null;
  utilitySkillIds: [number | null, number | null, number | null];
  eliteSkillId: number | null;
  underwaterSkills: {
    healSkillId: number | null;
    utilitySkillIds: [number | null, number | null, number | null];
    eliteSkillId: number | null;
  };
  equipment: BuilderEquipment;
  selectedLegends: [string, string];
  selectedUnderwaterLegends: [string, string];
  selectedPets: {
    terrestrial1: number;
    terrestrial2: number;
    aquatic1: number;
    aquatic2: number;
  };
  activeAttunement: string;
  activeAttunement2: string;
  activeKit: number;
  activeWeaponSet: number;
  allianceTacticsForm: number;
  antiquaryArtifacts: { f2: number; f3: number; f4: number };
}

export interface SavedBuilderBuild {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  shareCode: string;
  state: EntropyBuilderState;
}

export interface BuilderParty {
  id: string;
  name: string;
  slots: Array<string | null>;
}

export interface BuilderComposition {
  id: string;
  name: string;
  gameMode: Gw2GameMode;
  parties: BuilderParty[];
  createdAt: string;
  updatedAt: string;
}

export interface BuilderWorkspace {
  draft: EntropyBuilderState;
  builds: SavedBuilderBuild[];
  compositions: BuilderComposition[];
  activeCompositionId: string | null;
}

export type BuilderSummaryItem =
  | { kind: "profession"; item: Gw2Profession }
  | { kind: "specialization"; item: Gw2Specialization }
  | { kind: "trait"; item: Gw2Trait }
  | { kind: "skill"; item: Gw2Skill };
