import type {
  EntropyBuilderState,
  Gw2ItemStat,
  Gw2Legend,
  Gw2Pet,
  Gw2Profession,
  Gw2ProfessionWeapon,
} from "../../types/buildEditor";
import {
  fetchGw2ItemStats,
  fetchGw2Legends,
  fetchGw2Pets,
  fetchGw2Professions,
} from "./gw2Api";

export const BUILDER_CATALOG_CACHE_KEY = "entropy.builder.catalog.v1";
export const BUILDER_CATALOG_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type BuilderCatalogSource = "live" | "cache";

export interface BuilderFoundationCatalog {
  version: 1;
  loadedAt: string;
  source: BuilderCatalogSource;
  professions: Gw2Profession[];
  itemStats: Gw2ItemStat[];
  legends: Gw2Legend[];
  pets: Gw2Pet[];
}

type StoredBuilderCatalog = Omit<BuilderFoundationCatalog, "source">;

function storageAvailable(): boolean {
  return typeof localStorage !== "undefined";
}

export function readBuilderCatalogCache(allowExpired = false): BuilderFoundationCatalog | null {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(BUILDER_CATALOG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredBuilderCatalog>;
    if (parsed.version !== 1 || !parsed.loadedAt || !Array.isArray(parsed.professions)) return null;
    const age = Date.now() - Date.parse(parsed.loadedAt);
    if (!allowExpired && (!Number.isFinite(age) || age > BUILDER_CATALOG_CACHE_TTL_MS)) return null;
    return {
      version: 1,
      loadedAt: parsed.loadedAt,
      source: "cache",
      professions: parsed.professions,
      itemStats: Array.isArray(parsed.itemStats) ? parsed.itemStats : [],
      legends: Array.isArray(parsed.legends) ? parsed.legends : [],
      pets: Array.isArray(parsed.pets) ? parsed.pets : [],
    };
  } catch {
    return null;
  }
}

export function writeBuilderCatalogCache(catalog: BuilderFoundationCatalog): void {
  if (!storageAvailable()) return;
  try {
    const stored: StoredBuilderCatalog = {
      version: 1,
      loadedAt: catalog.loadedAt,
      professions: catalog.professions,
      itemStats: catalog.itemStats,
      legends: catalog.legends,
      pets: catalog.pets,
    };
    localStorage.setItem(BUILDER_CATALOG_CACHE_KEY, JSON.stringify(stored));
  } catch {
    // Catalog caching is an offline enhancement. A storage quota failure must
    // never prevent the live Builder from loading.
  }
}

export async function loadBuilderFoundationCatalog(options?: { forceRefresh?: boolean }): Promise<BuilderFoundationCatalog> {
  const cached = readBuilderCatalogCache(false);
  if (cached && !options?.forceRefresh) return cached;

  try {
    const [professions, itemStats, legends, pets] = await Promise.all([
      fetchGw2Professions(),
      fetchGw2ItemStats(),
      fetchGw2Legends(),
      fetchGw2Pets(),
    ]);
    const catalog: BuilderFoundationCatalog = {
      version: 1,
      loadedAt: new Date().toISOString(),
      source: "live",
      professions,
      itemStats,
      legends,
      pets,
    };
    writeBuilderCatalogCache(catalog);
    return catalog;
  } catch (error) {
    const stale = readBuilderCatalogCache(true);
    if (stale) return stale;
    throw error;
  }
}

export function availableProfessionWeapons(
  profession: Gw2Profession | null,
  specializationIds: Array<number | null>,
): Array<[string, Gw2ProfessionWeapon]> {
  if (!profession?.weapons) return [];
  return Object.entries(profession.weapons)
    .filter(([, weapon]) => !weapon.specialization || specializationIds.includes(weapon.specialization))
    .sort(([left], [right]) => left.localeCompare(right));
}

export function weaponFitsBuilderSlot(weapon: Gw2ProfessionWeapon, slot: string): boolean {
  const flags = weapon.flags ?? [];
  if (slot.startsWith("mainhand")) return flags.includes("Mainhand") || flags.includes("TwoHand");
  if (slot.startsWith("offhand")) return flags.includes("Offhand");
  return flags.includes("Aquatic") || flags.includes("TwoHand");
}

export function isTwoHandedWeapon(profession: Gw2Profession | null, weaponName: string): boolean {
  const match = Object.entries(profession?.weapons ?? {}).find(([name]) => name.toLowerCase() === weaponName.toLowerCase());
  return Boolean(match?.[1].flags?.includes("TwoHand"));
}

export function validateBuilderEquipmentAgainstCatalog(
  builder: EntropyBuilderState,
  profession: Gw2Profession | null,
): string[] {
  if (!profession) return [];
  const availableEntries = availableProfessionWeapons(profession, builder.specializationIds);
  const available = new Map(availableEntries.map(([name, weapon]) => [name.toLowerCase(), weapon]));
  const issues: string[] = [];
  for (const [slot, weapon] of Object.entries(builder.equipment.weapons)) {
    const definition = available.get(weapon.toLowerCase());
    if (weapon && !definition) issues.push(`${weapon} is not available to this profession and specialization setup.`);
    if (weapon && definition && !weaponFitsBuilderSlot(definition, slot)) issues.push(`${weapon} cannot be equipped in ${slot}.`);
    if (slot.startsWith("offhand")) {
      const mainhandSlot = slot.replace("offhand", "mainhand") as keyof typeof builder.equipment.weapons;
      if (weapon && isTwoHandedWeapon(profession, builder.equipment.weapons[mainhandSlot])) {
        issues.push(`Remove the ${slot.endsWith("1") ? "weapon set I" : "weapon set II"} offhand while using a two-handed weapon.`);
      }
    }
  }
  return [...new Set(issues)];
}
