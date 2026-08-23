import type {
  Gw2Item,
  Gw2ItemStat,
  Gw2Legend,
  Gw2Pet,
  Gw2Profession,
  Gw2Skill,
  Gw2Specialization,
  Gw2Trait,
} from "../../types/buildEditor";

const GW2_API_BASE = "https://api.guildwars2.com/v2";

const cache = new Map<string, Promise<unknown>>();

function stripMarkup(value?: string): string {
  return (value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\s+\n/g, "\n")
    .trim();
}

async function getJson<T>(path: string): Promise<T> {
  const url = `${GW2_API_BASE}${path}`;
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url).then((response) => {
        if (!response.ok) throw new Error(`GW2 API request failed (${response.status})`);
        return response.json() as Promise<T>;
      }),
    );
  }
  return cache.get(url) as Promise<T>;
}

function idsParam(ids: number[]): string {
  return ids.filter(Boolean).join(",");
}

export async function fetchGw2Professions(): Promise<Gw2Profession[]> {
  const professions = await getJson<Gw2Profession[]>("/professions?ids=all");
  return professions.sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchGw2Specializations(ids: number[]): Promise<Gw2Specialization[]> {
  if (!ids.length) return [];
  return getJson<Gw2Specialization[]>(`/specializations?ids=${idsParam(ids)}`);
}

export async function fetchGw2Traits(ids: number[]): Promise<Gw2Trait[]> {
  if (!ids.length) return [];
  const traits = await getJson<Gw2Trait[]>(`/traits?ids=${idsParam([...new Set(ids)])}`);
  return traits
    .map((trait) => ({ ...trait, description: stripMarkup(trait.description) }))
    .sort((a, b) => a.tier - b.tier || a.order - b.order || a.name.localeCompare(b.name));
}

export async function fetchGw2Skills(ids: number[]): Promise<Gw2Skill[]> {
  if (!ids.length) return [];
  const skills = await getJson<Gw2Skill[]>(`/skills?ids=${idsParam([...new Set(ids)])}`);
  return skills
    .map((skill) => ({ ...skill, description: stripMarkup(skill.description) }))
    .sort((a, b) => a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name));
}

export async function fetchGw2ItemStats(): Promise<Gw2ItemStat[]> {
  const stats = await getJson<Gw2ItemStat[]>("/itemstats?ids=all");
  return stats.sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchGw2Items(ids: number[]): Promise<Gw2Item[]> {
  const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (!uniqueIds.length) return [];
  const batches: number[][] = [];
  for (let index = 0; index < uniqueIds.length; index += 200) batches.push(uniqueIds.slice(index, index + 200));
  const items = (await Promise.all(batches.map((batch) => getJson<Gw2Item[]>(`/items?ids=${idsParam(batch)}`)))).flat();
  return items
    .map((item) => ({ ...item, description: stripMarkup(item.description) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchGw2Legends(): Promise<Gw2Legend[]> {
  const legends = await getJson<Gw2Legend[]>("/legends?ids=all");
  return legends.sort((a, b) => a.id.localeCompare(b.id));
}

export async function fetchGw2Pets(): Promise<Gw2Pet[]> {
  const pets = await getJson<Gw2Pet[]>("/pets?ids=all");
  return pets
    .map((pet) => ({ ...pet, description: stripMarkup(pet.description) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface Gw2LegendApiRecord {
  id: string;
  code: number;
  swap?: number;
  heal?: number;
  elite?: number;
  utilities?: number[];
}

/**
 * Skill "palette" ids used by GW2 in-game chat codes (see chatCode.ts) are a
 * different id space from the /v2/skills ids Entropy stores everywhere else.
 * The profession-detail endpoint's skills_by_palette field maps paletteId ->
 * skillId, only when queried with v=latest (per the wiki's chat-link-format
 * documentation), so we invert it here to the skillId -> paletteId direction
 * chat-code encoding actually needs.
 */
export async function fetchGw2ProfessionSkillPalette(professionId: string): Promise<Map<number, number>> {
  const detail = await getJson<{ skills_by_palette?: [number, number][] }>(`/professions/${professionId}?v=latest`);
  const paletteBySkillId = new Map<number, number>();
  for (const [paletteId, skillId] of detail.skills_by_palette ?? []) {
    paletteBySkillId.set(skillId, paletteId);
  }
  return paletteBySkillId;
}

export async function fetchGw2LegendCodes(ids: string[]): Promise<Gw2LegendApiRecord[]> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return [];
  return getJson<Gw2LegendApiRecord[]>(`/legends?ids=${uniqueIds.join(",")}`);
}

export function wikiSearchUrl(name: string): string {
  return `https://wiki.guildwars2.com/index.php?search=${encodeURIComponent(name)}`;
}
