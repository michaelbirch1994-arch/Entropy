import type { BuilderEquipment, Gw2Item } from "../../types/buildEditor";
import { fetchGw2Items } from "./gw2Api";

export const BUILDER_ITEM_CACHE_KEY = "entropy.builder.items.v1";

export interface BuilderNamedChoice {
  label: string;
  id?: number;
}

// These are the exact text choices supported by the installed AxiCode format.
// Keeping the codec vocabulary here makes the editor searchable without
// silently exporting a label that the binary format cannot preserve.
export const BUILDER_RELIC_CHOICES = [
  "Relic of Agony", "Relic of Akeem", "Relic of Altruism", "Relic of Antitoxin", "Relic of Atrocity",
  "Relic of Bava Nisos", "Relic of Bloodstone", "Relic of Castora", "Relic of Cerus", "Relic of Dagda",
  "Relic of Durability", "Relic of Dwayna", "Relic of Evasion", "Relic of Febe", "Relic of Fire",
  "Relic of Fireworks", "Relic of Fog", "Relic of Geysers", "Relic of Isgarren", "Relic of Karakosa",
  "Relic of Leadership", "Relic of Lyhr", "Relic of Mabon", "Relic of Mercy", "Relic of Mistburn",
  "Relic of Mosyn", "Relic of Mount Balrior", "Relic of Nayos", "Relic of Nourys", "Relic of Peitha",
  "Relic of Resistance", "Relic of Reunification", "Relic of Rivers", "Relic of Shackles", "Relic of Sorrow",
  "Relic of Speed", "Relic of Surging", "Relic of Thorns", "Relic of Vampirism", "Relic of Vass",
  "Relic of Zakiros", "Relic of the Adventurer", "Relic of the Afflicted", "Relic of the Alliance",
  "Relic of the Aristocracy", "Relic of the Astral Ward", "Relic of the Beehive", "Relic of the Biomancer",
  "Relic of the Blightbringer", "Relic of the Brawler", "Relic of the Cavalier", "Relic of the Centaur",
  "Relic of the Chronomancer", "Relic of the Citadel", "Relic of the Claw", "Relic of the Coral Heart",
  "Relic of the Daredevil", "Relic of the Deadeye", "Relic of the Defender", "Relic of the Demon Queen",
  "Relic of the Dragonhunter", "Relic of the Eagle", "Relic of the Earth", "Relic of the Firebrand",
  "Relic of the First Revenant", "Relic of the Flock", "Relic of the Forest Dweller", "Relic of the Founding",
  "Relic of the Fractal", "Relic of the Golemancer", "Relic of the Herald", "Relic of the Holosmith",
  "Relic of the Ice", "Relic of the Krait", "Relic of the Lich", "Relic of the Living City",
  "Relic of the Midnight King", "Relic of the Mirage", "Relic of the Mist Stranger", "Relic of the Mists Tide",
  "Relic of the Monk", "Relic of the Nautical Beast", "Relic of the Necromancer", "Relic of the Nightmare",
  "Relic of the Ogre", "Relic of the Pack", "Relic of the Phenom", "Relic of the Pirate Queen",
  "Relic of the Privateer", "Relic of the Reaper", "Relic of the Scoundrel", "Relic of the Scourge",
  "Relic of the Sorcerer", "Relic of the Steamshrieker", "Relic of the Stormsinger", "Relic of the Sunless",
  "Relic of the Thief", "Relic of the Trooper", "Relic of the Twin Generals", "Relic of the Unseen Invasion",
  "Relic of the Warrior", "Relic of the Water", "Relic of the Wayfinder", "Relic of the Weaver",
  "Relic of the Wizard's Tower", "Relic of the Zephyrite",
] as const;

export const BUILDER_FOOD_CHOICES: BuilderNamedChoice[] = [
  { label: "Peppercorn-Crusted Sous-Vide Steak", id: 91734 },
  { label: "Cilantro Lime Sous-Vide Steak", id: 91805 },
  { label: "Bowl of Sweet and Spicy Butternut Squash Soup", id: 41569 },
  { label: "Plate of Truffle Steak Dinner", id: 12469 },
  { label: "Bowl of Fancy Potato and Leek Soup", id: 12485 },
  { label: "Plate of Beef Rendang", id: 86997 },
  { label: "Plate of Kimchi Pancakes", id: 96578 },
  { label: "Mint-Pear Cured Meat Flatbread", id: 91703 },
  { label: "Clove-Spiced Pear and Cured Meat Flatbread", id: 91784 },
  { label: "Mint and Veggie Flatbread", id: 91727 },
  { label: "Delicious Rice Ball", id: 68634 },
  { label: "Eggs Benedict with Mint-Parsley Sauce", id: 91758 },
  { label: "Bowl of Fruit Salad with Mint Garnish", id: 91690 },
  { label: "Bowl of Seaweed Salad", id: 12471 },
];

export const BUILDER_UTILITY_CHOICES: BuilderNamedChoice[] = [
  { label: "Superior Sharpening Stone", id: 78305 },
  { label: "Furious Sharpening Stone", id: 67530 },
  { label: "Bountiful Sharpening Stone", id: 67531 },
  { label: "Bountiful Maintenance Oil", id: 67528 },
  { label: "Furious Maintenance Oil", id: 67529 },
];

function storageAvailable(): boolean {
  return typeof localStorage !== "undefined";
}

export function equipmentItemIds(equipment: BuilderEquipment): number[] {
  const values = [
    ...Object.values(equipment.runes),
    ...Object.values(equipment.sigils).flat(),
    equipment.enrichment,
  ];
  return [...new Set(values.map((value) => Number(value)).filter((id) => Number.isInteger(id) && id > 0))];
}

export function readBuilderItemCache(): Record<number, Gw2Item> {
  if (!storageAvailable()) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(BUILDER_ITEM_CACHE_KEY) ?? "{}") as Record<string, Gw2Item>;
    return Object.fromEntries(Object.entries(parsed).filter(([, item]) => item && Number.isInteger(item.id))) as Record<number, Gw2Item>;
  } catch {
    return {};
  }
}

function writeBuilderItemCache(items: Record<number, Gw2Item>): void {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(BUILDER_ITEM_CACHE_KEY, JSON.stringify(items));
  } catch {
    // Item names and icons are progressive enhancement. Raw AxiCode values
    // remain intact if browser storage is unavailable or full.
  }
}

export async function loadBuilderItemsByIds(ids: number[]): Promise<Record<number, Gw2Item>> {
  const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (!uniqueIds.length) return {};
  const cached = readBuilderItemCache();
  const missing = uniqueIds.filter((id) => !cached[id]);
  if (missing.length) {
    try {
      const fetched = await fetchGw2Items(missing);
      for (const item of fetched) cached[item.id] = item;
      writeBuilderItemCache(cached);
    } catch {
      // Imported IDs remain authoritative. Cached names can still enhance the
      // sheet when the GW2 API is unavailable, without blocking the editor.
    }
  }
  return Object.fromEntries(uniqueIds.flatMap((id) => cached[id] ? [[id, cached[id]]] : []));
}

export function choiceIsCodecSupported(value: string, choices: readonly string[]): boolean {
  return !value || choices.includes(value);
}
