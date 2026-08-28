import type { Gw2ApiFact, Gw2Skill, Gw2Trait } from "../../types/buildEditor";

const CONDITION_FACT_TYPES = new Set(["Buff", "ApplyBuffCondition", "PrefixedBuff"]);

export const BUILDER_CONDITION_DISPLAY_ORDER = [
  "Bleeding",
  "Burning",
  "Torment",
  "Poison",
  "Confusion",
  "Vulnerability",
  "Weakness",
  "Blind",
  "Crippled",
  "Chilled",
  "Immobilized",
  "Slow",
  "Fear",
  "Taunt",
];

const CONDITION_ALIASES = new Map([
  ["bleed", "Bleeding"],
  ["bleeding", "Bleeding"],
  ["burn", "Burning"],
  ["burning", "Burning"],
  ["torment", "Torment"],
  ["poison", "Poison"],
  ["poisoned", "Poison"],
  ["confusion", "Confusion"],
  ["vulnerability", "Vulnerability"],
  ["weakness", "Weakness"],
  ["blind", "Blind"],
  ["blinded", "Blind"],
  ["cripple", "Crippled"],
  ["crippled", "Crippled"],
  ["chill", "Chilled"],
  ["chilled", "Chilled"],
  ["immobilize", "Immobilized"],
  ["immobilized", "Immobilized"],
  ["slow", "Slow"],
  ["fear", "Fear"],
  ["taunt", "Taunt"],
]);

const FALLBACK_CONDITION_ICONS: Record<string, string> = {
  Bleeding: "https://wiki.guildwars2.com/images/3/33/Bleeding.png",
  Burning: "https://wiki.guildwars2.com/images/7/79/Burning.png",
  Torment: "https://wiki.guildwars2.com/images/0/08/Torment.png",
  Poison: "https://wiki.guildwars2.com/images/1/11/Poison.png",
  Confusion: "https://wiki.guildwars2.com/images/6/68/Confusion.png",
  Vulnerability: "https://wiki.guildwars2.com/images/a/aa/Vulnerability.png",
  Weakness: "https://wiki.guildwars2.com/images/f/f4/Weakness.png",
  Blind: "https://wiki.guildwars2.com/images/3/33/Blind.png",
  Crippled: "https://wiki.guildwars2.com/images/0/0a/Crippled.png",
  Chilled: "https://wiki.guildwars2.com/images/a/a6/Chilled.png",
  Immobilized: "https://wiki.guildwars2.com/images/3/32/Immobilized.png",
  Slow: "https://wiki.guildwars2.com/images/f/f5/Slow.png",
  Fear: "https://wiki.guildwars2.com/images/1/14/Fear.png",
  Taunt: "https://wiki.guildwars2.com/images/7/79/Taunt.png",
};

export interface BuilderConditionSource {
  type: "skill" | "trait";
  sourceName: string;
  stacks: number;
  duration: number;
  icon?: string;
}

export interface BuilderConditionEntry {
  name: string;
  sources: BuilderConditionSource[];
  icon?: string;
}

interface ConditionScanEntity {
  name: string;
  description?: string;
  facts?: Gw2ApiFact[];
}

function normalizeConditionName(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return CONDITION_ALIASES.get(normalized) ?? null;
}

function textConditionNames(entity: ConditionScanEntity): string[] {
  const haystack = [
    entity.description,
    ...(entity.facts ?? []).flatMap((fact) => [fact.text, fact.status, fact.description]),
  ].filter(Boolean).join(" ").toLowerCase();

  const names = new Set<string>();
  for (const [alias, name] of CONDITION_ALIASES) {
    const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(haystack)) names.add(name);
  }
  return [...names];
}

function addCondition(
  conditionMap: Map<string, BuilderConditionEntry>,
  name: string,
  entity: ConditionScanEntity,
  type: "skill" | "trait",
  fact?: Gw2ApiFact,
) {
  const source: BuilderConditionSource = {
    type,
    sourceName: entity.name || "",
    stacks: fact?.apply_count || 1,
    duration: fact?.duration || 0,
    icon: fact?.icon,
  };
  const entry = conditionMap.get(name) ?? { name, sources: [], icon: FALLBACK_CONDITION_ICONS[name] };
  const isDuplicate = entry.sources.some(
    (existing) =>
      existing.sourceName === source.sourceName &&
      existing.stacks === source.stacks &&
      existing.duration === source.duration,
  );
  if (!isDuplicate) entry.sources.push(source);
  if (!entry.icon && source.icon) entry.icon = source.icon;
  conditionMap.set(name, entry);
}

function scanEntity(entity: ConditionScanEntity, type: "skill" | "trait", conditionMap: Map<string, BuilderConditionEntry>) {
  for (const fact of entity.facts ?? []) {
    if (!fact.type || !CONDITION_FACT_TYPES.has(fact.type)) continue;
    const name = normalizeConditionName(fact.status);
    if (name) addCondition(conditionMap, name, entity, type, fact);
  }

  for (const name of textConditionNames(entity)) {
    addCondition(conditionMap, name, entity, type);
  }
}

export function fallbackConditionIcon(name: string): string | undefined {
  return FALLBACK_CONDITION_ICONS[name];
}

export function analyzeBuildConditions(skills: Gw2Skill[], traits: Gw2Trait[]): BuilderConditionEntry[] {
  const conditionMap = new Map<string, BuilderConditionEntry>();
  for (const skill of skills) scanEntity(skill, "skill", conditionMap);
  for (const trait of traits) scanEntity(trait, "trait", conditionMap);

  const order = new Map(BUILDER_CONDITION_DISPLAY_ORDER.map((name, index) => [name, index]));
  return [...conditionMap.values()]
    .map((entry) => ({
      ...entry,
      icon: entry.sources.find((source) => source.icon)?.icon ?? entry.icon ?? fallbackConditionIcon(entry.name),
    }))
    .sort((left, right) => (order.get(left.name) ?? 999) - (order.get(right.name) ?? 999));
}
