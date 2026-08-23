// GW2 attribute math for the Entropy Builder "Preview" panel.
//
// Sources (Guild Wars 2 Wiki, verified live before writing this):
// - https://wiki.guildwars2.com/wiki/Attribute_combinations
//   "Attribute bonuses at level 80" (Ascended column) for per-slot
//   major/minor point values, and "Three or more attributes" for which
//   attributes are major/minor on each stat combination.
// - https://wiki.guildwars2.com/wiki/Health for base health per
//   profession and the Vitality -> Health conversion (10 HP per point).
// - https://wiki.guildwars2.com/wiki/Critical_Chance,
//   https://wiki.guildwars2.com/wiki/Ferocity,
//   https://wiki.guildwars2.com/wiki/Concentration,
//   https://wiki.guildwars2.com/wiki/Attribute
//   for the derived-stat formulas.
//
// Scope: base 1000 primary stats + equipment (armor, weapons, trinkets)
// at full Ascended rarity -- the same assumption every public build
// calculator makes. Rune 6pc bonuses, food/utility flat stats, and
// flat-stat traits are NOT modeled yet (see TODO at the bottom): they mix
// plain "+N Attribute" text with proc effects that carry no stat value,
// so they need their own parser rather than reusing combat facts.

import type { EntropyBuilderState, Gw2Profession } from "../../types/buildEditor";
import { isTwoHandedWeapon } from "./builderCatalog";

export type Gw2Attribute =
    | "Power" | "Precision" | "Toughness" | "Vitality"
  | "Concentration" | "ConditionDamage" | "Expertise" | "Ferocity" | "HealingPower";

export interface AttributeTotals {
    power: number;
    precision: number;
    toughness: number;
    vitality: number;
    concentration: number;
    conditionDamage: number;
    expertise: number;
    ferocity: number;
    healingPower: number;
    health: number;
    critChance: number;
    critDamage: number;
    boonDuration: number;
    conditionDuration: number;
}

const BASE_PRIMARY = { Power: 1000, Precision: 1000, Toughness: 1000, Vitality: 1000 } as const;

const HEALTH_BASE_BY_PROFESSION: Record<string, number> = {
    Warrior: 9212,
    Necromancer: 9212,
    Revenant: 5922,
    Engineer: 5922,
    Ranger: 5922,
    Mesmer: 5922,
    Guardian: 1645,
    Thief: 1645,
    Elementalist: 1645,
};

interface SlotBudget {
    major: number;
    minor: number;
}

type SlotKey = "oneHand" | "twoHand" | "head" | "shoulders" | "chest" | "hands" | "legs" | "feet" | "amulet" | "ring" | "accessory" | "back";

// Ascended, level 80. "3stat" = a single major attribute (Berserker's
// style). "4stat" = two major attributes (Trailblazer's style).
const BUDGET_3STAT: Record<SlotKey, SlotBudget> = {
    oneHand: { major: 125, minor: 90 },
    twoHand: { major: 251, minor: 179 },
    head: { major: 63, minor: 45 },
    shoulders: { major: 47, minor: 34 },
    chest: { major: 141, minor: 101 },
    hands: { major: 47, minor: 34 },
    legs: { major: 94, minor: 67 },
    feet: { major: 47, minor: 34 },
    amulet: { major: 157, minor: 108 },
    ring: { major: 126, minor: 85 },
    accessory: { major: 110, minor: 74 },
    back: { major: 63, minor: 40 },
};

const BUDGET_4STAT: Record<SlotKey, SlotBudget> = {
    oneHand: { major: 108, minor: 59 },
    twoHand: { major: 215, minor: 118 },
    head: { major: 54, minor: 30 },
    shoulders: { major: 40, minor: 22 },
    chest: { major: 121, minor: 67 },
    hands: { major: 40, minor: 22 },
    legs: { major: 81, minor: 44 },
    feet: { major: 40, minor: 22 },
    amulet: { major: 133, minor: 71 },
    ring: { major: 106, minor: 56 },
    accessory: { major: 92, minor: 49 },
    back: { major: 52, minor: 27 },
};

const CELESTIAL_9STAT: Record<SlotKey, number> = {
    oneHand: 59, twoHand: 118, head: 30, shoulders: 22, chest: 67, hands: 22, legs: 44, feet: 22,
    amulet: 72, ring: 57, accessory: 50, back: 28,
};

interface StatCombo {
    major: Gw2Attribute[];
    minor: Gw2Attribute[];
    celestial?: boolean;
}

// The subset of stat combinations Entropy's builder actually offers
// (STAT_OPTIONS in builderModel.ts). Roles verified against the wiki's
// "Three or more attributes" table.
const STAT_COMBOS: Record<string, StatCombo> = {
    "Berserker's": { major: ["Power"], minor: ["Precision", "Ferocity"] },
    "Marauder's": { major: ["Power", "Precision"], minor: ["Vitality", "Ferocity"] },
    "Assassin's": { major: ["Precision"], minor: ["Power", "Ferocity"] },
    "Valkyrie": { major: ["Power"], minor: ["Vitality", "Ferocity"] },
    "Dragon's": { major: ["Power", "Ferocity"], minor: ["Precision", "Vitality"] },
    "Viper's": { major: ["Power", "ConditionDamage"], minor: ["Precision", "Expertise"] },
    "Grieving": { major: ["Power", "ConditionDamage"], minor: ["Precision", "Ferocity"] },
    "Sinister": { major: ["ConditionDamage"], minor: ["Power", "Precision"] },
    "Dire": { major: ["ConditionDamage"], minor: ["Toughness", "Vitality"] },
    "Rabid": { major: ["ConditionDamage"], minor: ["Precision", "Toughness"] },
    "Carrion": { major: ["ConditionDamage"], minor: ["Power", "Vitality"] },
    "Trailblazer's": { major: ["Toughness", "ConditionDamage"], minor: ["Vitality", "Expertise"] },
    "Knight's": { major: ["Toughness"], minor: ["Power", "Precision"] },
    "Soldier's": { major: ["Power"], minor: ["Toughness", "Vitality"] },
    "Cleric's": { major: ["HealingPower"], minor: ["Power", "Toughness"] },
    "Minstrel's": { major: ["Toughness", "HealingPower"], minor: ["Vitality", "Concentration"] },
    "Harrier's": { major: ["Power"], minor: ["HealingPower", "Concentration"] },
    "Ritualist's": { major: ["Vitality", "ConditionDamage"], minor: ["Concentration", "Expertise"] },
    "Seraph": { major: ["Precision", "ConditionDamage"], minor: ["Concentration", "HealingPower"] },
    "Zealot's": { major: ["Power"], minor: ["Precision", "HealingPower"] },
    "Celestial": { major: [], minor: [], celestial: true },
};

const ARMOR_SLOTS: SlotKey[] = ["head", "shoulders", "chest", "hands", "legs", "feet"];

const ALL_ATTRIBUTES: Gw2Attribute[] = ["Power", "Precision", "Toughness", "Vitality", "Concentration", "ConditionDamage", "Expertise", "Ferocity", "HealingPower"];

function addAttribute(totals: Record<Gw2Attribute, number>, attribute: Gw2Attribute, value: number) {
    totals[attribute] = (totals[attribute] ?? 0) + value;
}

function applyStatPiece(totals: Record<Gw2Attribute, number>, statName: string, slotKey: SlotKey) {
    const combo = STAT_COMBOS[statName];
    if (!combo) return;
    if (combo.celestial) {
          const value = CELESTIAL_9STAT[slotKey];
          ALL_ATTRIBUTES.forEach((attribute) => addAttribute(totals, attribute, value));
          return;
    }
    const isFourStat = combo.major.length === 2;
    const budget = (isFourStat ? BUDGET_4STAT : BUDGET_3STAT)[slotKey];
    if (!budget) return;
    combo.major.forEach((attribute) => addAttribute(totals, attribute, budget.major));
    combo.minor.forEach((attribute) => addAttribute(totals, attribute, budget.minor));
}

/**
 * Compute base + equipment attribute totals for a build, assuming full
 * Ascended gear in the build's chosen stat package. Runes, food/utility,
 * and trait bonuses are not included yet -- see the file header.
 */
export function computeAttributeTotals(builder: EntropyBuilderState, profession: Gw2Profession | null): AttributeTotals {
    const totals: Record<Gw2Attribute, number> = {
          Power: BASE_PRIMARY.Power,
          Precision: BASE_PRIMARY.Precision,
          Toughness: BASE_PRIMARY.Toughness,
          Vitality: BASE_PRIMARY.Vitality,
          Concentration: 0,
          ConditionDamage: 0,
          Expertise: 0,
          Ferocity: 0,
          HealingPower: 0,
    };

  const statName = builder.equipment.statPackage;
    if (statName && STAT_COMBOS[statName]) {
          ARMOR_SLOTS.forEach((slot) => applyStatPiece(totals, statName, slot));
          applyStatPiece(totals, statName, "amulet");
          applyStatPiece(totals, statName, "ring");
          applyStatPiece(totals, statName, "ring");
          applyStatPiece(totals, statName, "accessory");
          applyStatPiece(totals, statName, "accessory");
          applyStatPiece(totals, statName, "back");

      const mainhand = builder.equipment.weapons.mainhand1;
          const offhand = builder.equipment.weapons.offhand1;
          if (mainhand) {
                  const twoHanded = isTwoHandedWeapon(profession, mainhand);
                  applyStatPiece(totals, statName, twoHanded ? "twoHand" : "oneHand");
                  if (!twoHanded && offhand) applyStatPiece(totals, statName, "oneHand");
          }
    }

  const healthBase = HEALTH_BASE_BY_PROFESSION[profession?.id ?? builder.professionId] ?? 5922;
    const health = healthBase + totals.Vitality * 10;

  const critChance = Math.max(0, Math.min(100, 5 + (totals.Precision - 1000) / 21));
    const critDamage = 150 + totals.Ferocity / 15;
    const boonDuration = totals.Concentration / 15;
    const conditionDuration = totals.Expertise / 15;

  return {
        power: totals.Power,
        precision: totals.Precision,
        toughness: totals.Toughness,
        vitality: totals.Vitality,
        concentration: totals.Concentration,
        conditionDamage: totals.ConditionDamage,
        expertise: totals.Expertise,
        ferocity: totals.Ferocity,
        healingPower: totals.HealingPower,
        health,
        critChance,
        critDamage,
        boonDuration,
        conditionDuration,
  };
}

// TODO(attributes-v2): fold in rune 6-piece bonuses, food/utility flat
// stats, and flat-stat traits once we've verified the exact shape of
// Gw2Item bonus text and Gw2ApiFact for a live rune and consumable.
