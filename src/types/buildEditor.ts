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

export interface EntropyBuilderState {
  professionId: string;
  gameMode: Gw2GameMode;
  specializationIds: [number | null, number | null, number | null];
  traitChoices: Record<string, number | null>;
  healSkillId: number | null;
  utilitySkillIds: [number | null, number | null, number | null];
  eliteSkillId: number | null;
}

export type BuilderSummaryItem =
  | { kind: "profession"; item: Gw2Profession }
  | { kind: "specialization"; item: Gw2Specialization }
  | { kind: "trait"; item: Gw2Trait }
  | { kind: "skill"; item: Gw2Skill };
