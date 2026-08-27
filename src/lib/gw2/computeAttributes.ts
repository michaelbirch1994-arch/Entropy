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
// Scope: base 1000 primary stats + equipment (armor, active weapon set,
// trinkets) at full Ascended rarity -- the same assumption every public
// build calculator makes. Full rune-set attribute bonuses plus supported
// food/utility attribute bonuses are modeled. Proc/on-kill effects and
// flat-stat traits are intentionally left out of the totals.

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

export interface AttributeContribution {
  label: string;
  source: "base" | "armor" | "trinket" | "weapon" | "rune" | "food" | "utility";
  stats: Partial<Record<Gw2Attribute, number>>;
}

export interface AttributePressureScores {
  strike: number;
  condition: number;
  support: number;
  sustain: number;
}

export interface AttributeProfile {
  totals: AttributeTotals;
  contributions: AttributeContribution[];
  equippedSlots: number;
  totalSlots: number;
  activeWeaponSet: 1 | 2;
  pressure: AttributePressureScores;
  primaryIdentity: keyof AttributePressureScores;
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
const TRINKET_SLOTS: Array<[string, SlotKey]> = [
  ["amulet", "amulet"],
  ["ring1", "ring"],
  ["ring2", "ring"],
  ["accessory1", "accessory"],
  ["accessory2", "accessory"],
  ["backpack", "back"],
];

const ALL_ATTRIBUTES: Gw2Attribute[] = ["Power", "Precision", "Toughness", "Vitality", "Concentration", "ConditionDamage", "Expertise", "Ferocity", "HealingPower"];

// Generated from the supported rune IDs in builderEquipmentCatalog.ts via
// GW2 API item details.bonuses. Percent boon/condition duration entries are
// converted into Concentration/Expertise equivalents so derived duration math
// stays in one place.
const RUNE_ATTRIBUTE_BONUSES: Record<string, Partial<Record<Gw2Attribute, number>>> = {
  "38206": { HealingPower: 175, Concentration: 225, Vitality: 125 },
  "48907": { ConditionDamage: 175, Vitality: 125 },
  "24765": { ConditionDamage: 175 },
  "24732": { Power: 78, Precision: 78, Toughness: 78, Vitality: 78, Concentration: 78, ConditionDamage: 78, Expertise: 78, Ferocity: 78, HealingPower: 78 },
  "73653": { Toughness: 175, Concentration: 225, Vitality: 125 },
  "24768": { HealingPower: 175, Vitality: 125 },
  "67344": { Ferocity: 300 },
  "44951": { Vitality: 175, HealingPower: 35, Precision: 65, Power: 125 },
  "89999": { Power: 175, Concentration: 375 },
  "24779": { ConditionDamage: 175 },
  "24729": { Power: 175, Concentration: 150 },
  "24703": { Power: 175, Precision: 225 },
  "70600": { Power: 36, Precision: 36, Toughness: 36, Vitality: 36, Concentration: 411, ConditionDamage: 36, Expertise: 36, Ferocity: 36, HealingPower: 36 },
  "24776": { Precision: 175, Expertise: 225, Concentration: 150 },
  "24771": { Toughness: 175, Vitality: 35 },
  "24708": { Toughness: 175, HealingPower: 190 },
  "81091": { HealingPower: 175 },
  "24860": { ConditionDamage: 175 },
  "44957": { ConditionDamage: 175 },
  "67342": { Vitality: 175, Concentration: 375 },
  "24717": { Ferocity: 300 },
  "24726": { Precision: 175, Expertise: 150 },
  "49460": { Toughness: 175 },
  "24857": { Vitality: 300, Concentration: 225 },
  "24738": { ConditionDamage: 175, Vitality: 100 },
  "68437": { Toughness: 175, HealingPower: 100 },
  "24720": { Vitality: 175 },
  "24714": { Power: 175 },
  "76813": { Power: 175, Concentration: 225 },
  "24794": { Toughness: 175 },
  "24830": { ConditionDamage: 175, Power: 225 },
  "24687": { ConditionDamage: 175, Expertise: 150 },
  "24750": { Ferocity: 175 },
  "24845": { ConditionDamage: 175 },
  "24854": { Power: 175, Expertise: 150 },
  "71425": { ConditionDamage: 300, Power: 100 },
  "24833": { Power: 175, Toughness: 225 },
  "83367": { Power: 175, Toughness: 100 },
  "24788": { Power: 175 },
  "73399": { Power: 175, Precision: 100, Concentration: 150 },
  "24741": { Power: 175 },
  "72852": { Power: 175, Toughness: 100, ConditionDamage: 125 },
  "82791": { Power: 175, Ferocity: 100, Precision: 125 },
  "67912": { Toughness: 175, HealingPower: 100, Vitality: 125 },
  "24699": { Toughness: 300, Vitality: 100 },
  "74978": { Ferocity: 300, Power: 100 },
  "70450": { HealingPower: 300, Vitality: 100 },
  "24723": { Precision: 175, Ferocity: 225 },
  "24744": { Toughness: 175, HealingPower: 125 },
  "24800": { Power: 175, ConditionDamage: 225 },
  "24812": { Toughness: 175, ConditionDamage: 225 },
  "24747": { Power: 175 },
  "83338": { ConditionDamage: 175, Concentration: 150 },
  "24797": { Power: 175 },
  "24696": { HealingPower: 175, Vitality: 225 },
  "24851": { Toughness: 175 },
  "24785": { Ferocity: 300, Precision: 100 },
  "24735": { HealingPower: 175 },
  "24824": { Toughness: 300, HealingPower: 100 },
  "76100": { Toughness: 175, Concentration: 375 },
  "82633": { Power: 175, Vitality: 100, Precision: 125 },
  "24753": { Vitality: 300 },
  "24762": { ConditionDamage: 175 },
  "24688": { Vitality: 175, Expertise: 375 },
  "36044": { Power: 175, Expertise: 75 },
  "24803": { Power: 175, Precision: 100 },
  "84127": { ConditionDamage: 175, Toughness: 100, Vitality: 125 },
  "24842": { HealingPower: 300, Concentration: 225 },
  "24806": { ConditionDamage: 300, Vitality: 100 },
  "24848": { ConditionDamage: 175, Expertise: 300 },
  "24756": { Power: 175, Ferocity: 100, Vitality: 125 },
  "24702": { Power: 175, Concentration: 225, Precision: 125 },
  "24782": { Power: 175, Precision: 125 },
  "24815": { Precision: 300, Ferocity: 100 },
  "70829": { Power: 175, Toughness: 100, Precision: 125 },
  "84171": { Concentration: 225, Toughness: 125 },
  "83502": { ConditionDamage: 300, Ferocity: 100 },
  "69370": { Power: 60, Precision: 60, Toughness: 60, Vitality: 185, Concentration: 60, ConditionDamage: 60, Expertise: 60, Ferocity: 60, HealingPower: 60 },
  "24836": { Power: 175, Ferocity: 225 },
  "83663": { ConditionDamage: 100, HealingPower: 125 },
  "71276": { Power: 175, Toughness: 100, Vitality: 125 },
  "83964": { ConditionDamage: 175, Power: 100, Vitality: 125 },
  "84749": { Power: 175, Precision: 100, Vitality: 125 },
  "85713": { Power: 36, Precision: 36, Toughness: 36, Vitality: 36, Concentration: 36, ConditionDamage: 36, Expertise: 36, Ferocity: 36, HealingPower: 36 },
  "47908": { ConditionDamage: 300 },
  "76166": { Power: 36, Precision: 36, Toughness: 36, Vitality: 36, Concentration: 36, ConditionDamage: 36, Expertise: 411, Ferocity: 36, HealingPower: 36 },
  "24818": { Precision: 300, ConditionDamage: 100 },
  "67339": { ConditionDamage: 300, Expertise: 225 },
  "24691": { Power: 36, Precision: 36, Toughness: 36, Vitality: 36, Concentration: 261, ConditionDamage: 36, Expertise: 36, Ferocity: 36, HealingPower: 36 },
  "24827": { Vitality: 175, Toughness: 225 },
  "24757": { ConditionDamage: 175, Toughness: 225 },
  "24821": { Vitality: 300, Power: 100 },
  "24839": { HealingPower: 175, Concentration: 375 },
  "83423": { Power: 36, Precision: 36, Toughness: 36, Vitality: 36, Concentration: 36, ConditionDamage: 36, Expertise: 186, Ferocity: 36, HealingPower: 36 },
  "24791": { Vitality: 175, Ferocity: 225 },
  "88118": { Power: 60, Precision: 60, Toughness: 60, Vitality: 60, Concentration: 210, ConditionDamage: 60, Expertise: 60, Ferocity: 60, HealingPower: 60 },
  "72912": { ConditionDamage: 175 },
  "44956": { ConditionDamage: 175 },
  "24711": { Power: 175, Vitality: 225 },
};

const FOOD_ATTRIBUTE_BONUSES: Record<string, Partial<Record<Gw2Attribute, number>>> = {
  "Peppercorn-Crusted Sous-Vide Steak": { Power: 100, Ferocity: 70 },
  "Cilantro Lime Sous-Vide Steak": { ConditionDamage: 100, Expertise: 70 },
  "Bowl of Sweet and Spicy Butternut Squash Soup": { Power: 100, Ferocity: 70 },
  "Plate of Truffle Steak Dinner": { Ferocity: 70 },
  "Bowl of Fancy Potato and Leek Soup": { Precision: 100, ConditionDamage: 70 },
  "Plate of Beef Rendang": { ConditionDamage: 100, Expertise: 70 },
  "Plate of Kimchi Pancakes": { ConditionDamage: 70 },
  "Mint-Pear Cured Meat Flatbread": { HealingPower: 100, Concentration: 70 },
  "Clove-Spiced Pear and Cured Meat Flatbread": { Concentration: 100, HealingPower: 70 },
  "Mint and Veggie Flatbread": { HealingPower: 100, Concentration: 70 },
  "Delicious Rice Ball": { HealingPower: 100 },
  "Eggs Benedict with Mint-Parsley Sauce": { HealingPower: 100, Concentration: 70 },
  "Bowl of Fruit Salad with Mint Garnish": { HealingPower: 100, Concentration: 70 },
};

function addAttribute(totals: Record<Gw2Attribute, number>, attribute: Gw2Attribute, value: number) {
    totals[attribute] = (totals[attribute] ?? 0) + value;
}

function cleanStats(stats: Record<Gw2Attribute, number>): Partial<Record<Gw2Attribute, number>> {
  return Object.fromEntries(Object.entries(stats).filter(([, value]) => value !== 0)) as Partial<Record<Gw2Attribute, number>>;
}

function emptyContributionStats(): Record<Gw2Attribute, number> {
  return {
    Power: 0,
    Precision: 0,
    Toughness: 0,
    Vitality: 0,
    Concentration: 0,
    ConditionDamage: 0,
    Expertise: 0,
    Ferocity: 0,
    HealingPower: 0,
  };
}

function applyAttributeBonuses(
  totals: Record<Gw2Attribute, number>,
  bonuses: Partial<Record<Gw2Attribute, number>>,
): Record<Gw2Attribute, number> {
  const applied = emptyContributionStats();
  ALL_ATTRIBUTES.forEach((attribute) => {
    const value = bonuses[attribute] ?? 0;
    if (!value) return;
    addAttribute(totals, attribute, value);
    applied[attribute] += value;
  });
  return applied;
}

function mergeContribution(
  target: Record<Gw2Attribute, number>,
  addition: Record<Gw2Attribute, number>,
) {
  ALL_ATTRIBUTES.forEach((attribute) => {
    target[attribute] += addition[attribute] ?? 0;
  });
}

function applyStatPiece(totals: Record<Gw2Attribute, number>, statName: string, slotKey: SlotKey): Record<Gw2Attribute, number> {
    const applied = emptyContributionStats();
    const combo = STAT_COMBOS[statName];
    if (!combo) return applied;
    if (combo.celestial) {
          const value = CELESTIAL_9STAT[slotKey];
          ALL_ATTRIBUTES.forEach((attribute) => {
            addAttribute(totals, attribute, value);
            applied[attribute] += value;
          });
          return applied;
    }
    const isFourStat = combo.major.length === 2;
    const budget = (isFourStat ? BUDGET_4STAT : BUDGET_3STAT)[slotKey];
    if (!budget) return applied;
    combo.major.forEach((attribute) => {
      addAttribute(totals, attribute, budget.major);
      applied[attribute] += budget.major;
    });
    combo.minor.forEach((attribute) => {
      addAttribute(totals, attribute, budget.minor);
      applied[attribute] += budget.minor;
    });
    return applied;
}

/**
 * Compute base + equipment attribute totals for a build, assuming full
 * Ascended gear in the build's chosen stat package. Runes, food/utility,
 * and trait bonuses are not included yet -- see the file header.
 */
function slotStat(builder: EntropyBuilderState, slot: string): string {
  return builder.equipment.slots[slot] || builder.equipment.statPackage;
}

function sixPieceRuneId(builder: EntropyBuilderState): string {
  const runeIds = Object.values(builder.equipment.runes).filter(Boolean);
  if (runeIds.length !== ARMOR_SLOTS.length) return "";
  return runeIds.every((id) => id === runeIds[0]) ? runeIds[0] : "";
}

function applyFullRuneSet(totals: Record<Gw2Attribute, number>, builder: EntropyBuilderState): Record<Gw2Attribute, number> {
  const runeId = sixPieceRuneId(builder);
  if (!runeId) return emptyContributionStats();
  return applyAttributeBonuses(totals, RUNE_ATTRIBUTE_BONUSES[runeId] ?? {});
}

function applyFood(totals: Record<Gw2Attribute, number>, builder: EntropyBuilderState): Record<Gw2Attribute, number> {
  return applyAttributeBonuses(totals, FOOD_ATTRIBUTE_BONUSES[builder.equipment.food] ?? {});
}

function applyUtility(totals: Record<Gw2Attribute, number>, builder: EntropyBuilderState): Record<Gw2Attribute, number> {
  const bonuses: Partial<Record<Gw2Attribute, number>> = {};
  switch (builder.equipment.utility) {
    case "Superior Sharpening Stone":
      bonuses.Power = Math.round(totals.Precision * 0.03 + totals.Ferocity * 0.06);
      break;
    case "Furious Sharpening Stone":
      bonuses.Power = Math.round(totals.Precision * 0.03);
      bonuses.Ferocity = Math.round(totals.Precision * 0.03);
      break;
    case "Bountiful Sharpening Stone":
      bonuses.Power = Math.round(totals.HealingPower * 0.06 + totals.Concentration * 0.08);
      break;
    case "Furious Maintenance Oil":
      bonuses.Concentration = Math.round(totals.Precision * 0.03);
      bonuses.HealingPower = Math.round(totals.Precision * 0.03);
      break;
    default:
      break;
  }
  return applyAttributeBonuses(totals, bonuses);
}

function normalizePressureScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function pressureScores(totals: AttributeTotals): AttributePressureScores {
  return {
    strike: normalizePressureScore(
      (totals.power - 1000) / 15 +
      (totals.precision - 1000) / 25 +
      totals.ferocity / 18,
    ),
    condition: normalizePressureScore(
      totals.conditionDamage / 13 +
      totals.expertise / 18,
    ),
    support: normalizePressureScore(
      totals.concentration / 16 +
      totals.healingPower / 16,
    ),
    sustain: normalizePressureScore(
      (totals.toughness - 1000) / 18 +
      (totals.vitality - 1000) / 22 +
      totals.healingPower / 24,
    ),
  };
}

function primaryIdentity(pressure: AttributePressureScores): keyof AttributePressureScores {
  return (Object.entries(pressure) as Array<[keyof AttributePressureScores, number]>)
    .sort((left, right) => right[1] - left[1])[0][0];
}

/**
 * Compute base + equipment attribute totals plus tactical summaries for the
 * Builder UI. This keeps combat-facing labels separate from the raw math so
 * the stat engine can evolve without changing saved AxiCode payloads.
 */
export function computeAttributeProfile(builder: EntropyBuilderState, profession: Gw2Profession | null): AttributeProfile {
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
  const baseStats = emptyContributionStats();
  baseStats.Power = BASE_PRIMARY.Power;
  baseStats.Precision = BASE_PRIMARY.Precision;
  baseStats.Toughness = BASE_PRIMARY.Toughness;
  baseStats.Vitality = BASE_PRIMARY.Vitality;
  const armorStats = emptyContributionStats();
  const trinketStats = emptyContributionStats();
  const weaponStats = emptyContributionStats();
  let runeStats = emptyContributionStats();
  let foodStats = emptyContributionStats();
  let utilityStats = emptyContributionStats();

  ARMOR_SLOTS.forEach((slot) => mergeContribution(armorStats, applyStatPiece(totals, slotStat(builder, slot), slot)));
  TRINKET_SLOTS.forEach(([slot, budgetKey]) => mergeContribution(trinketStats, applyStatPiece(totals, slotStat(builder, slot), budgetKey)));

  const activeSet = builder.activeWeaponSet === 2 ? 2 : 1;
  const mainhand = builder.equipment.weapons[`mainhand${activeSet}`];
  const offhand = builder.equipment.weapons[`offhand${activeSet}`];
  const mainhandStat = slotStat(builder, `mainhand${activeSet}`);
  const offhandStat = slotStat(builder, `offhand${activeSet}`);
  if (mainhand) {
    const twoHanded = isTwoHandedWeapon(profession, mainhand);
    mergeContribution(weaponStats, applyStatPiece(totals, mainhandStat, twoHanded ? "twoHand" : "oneHand"));
    if (!twoHanded && offhand) mergeContribution(weaponStats, applyStatPiece(totals, offhandStat, "oneHand"));
  }

  runeStats = applyFullRuneSet(totals, builder);
  foodStats = applyFood(totals, builder);
  utilityStats = applyUtility(totals, builder);

  const healthBase = HEALTH_BASE_BY_PROFESSION[profession?.id ?? builder.professionId] ?? 5922;
    const health = healthBase + totals.Vitality * 10;

  const critChance = Math.max(0, Math.min(100, 5 + (totals.Precision - 1000) / 21));
    const critDamage = 150 + totals.Ferocity / 15;
    const boonDuration = totals.Concentration / 15;
    const conditionDuration = totals.Expertise / 15;

  const computedTotals = {
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
  const pressure = pressureScores(computedTotals);
  const equippedWeapons = mainhand ? isTwoHandedWeapon(profession, mainhand) ? 2 : 1 + (offhand ? 1 : 0) : 0;
  const equippedSlots = ARMOR_SLOTS.length + TRINKET_SLOTS.length + equippedWeapons;

  return {
    totals: computedTotals,
    contributions: [
      { label: "Base chassis", source: "base", stats: cleanStats(baseStats) },
      { label: "Armor", source: "armor", stats: cleanStats(armorStats) },
      { label: "Trinkets", source: "trinket", stats: cleanStats(trinketStats) },
      { label: `Weapon set ${activeSet === 1 ? "I" : "II"}`, source: "weapon", stats: cleanStats(weaponStats) },
      { label: "Rune set", source: "rune", stats: cleanStats(runeStats) },
      { label: "Food", source: "food", stats: cleanStats(foodStats) },
      { label: "Utility", source: "utility", stats: cleanStats(utilityStats) },
    ],
    equippedSlots,
    totalSlots: ARMOR_SLOTS.length + TRINKET_SLOTS.length + 2,
    activeWeaponSet: activeSet,
    pressure,
    primaryIdentity: primaryIdentity(pressure),
  };
}

export function computeAttributeTotals(builder: EntropyBuilderState, profession: Gw2Profession | null): AttributeTotals {
  return computeAttributeProfile(builder, profession).totals;
}
