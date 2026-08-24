import type { EntropyBuilderState, Gw2Legend } from "../../types/buildEditor";
import { isTauriRuntime } from "../../utils/runtime";
import {
  BUILDER_ENRICHMENT_CHOICES,
  BUILDER_RUNE_CHOICES,
  BUILDER_SIGIL_CHOICES,
} from "./builderEquipmentCatalog";
import { fetchGw2ProfessionSkillPalette } from "./gw2Api";
import { decodeBuildChatCode, professionFromBuildChatCode } from "./chatCode";

type JsonRecord = Record<string, unknown>;

export interface Gw2SkillsImportResult {
  state: EntropyBuilderState;
  warnings: string[];
  sourceUrl: string;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function validateGw2SkillsEditorUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Paste a complete gw2skills.net editor URL.");
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !(host === "gw2skills.net" || host.endsWith(".gw2skills.net"))) {
    throw new Error("Only public HTTPS gw2skills.net editor links can be imported.");
  }
  if (!/^\/editor\/?$/i.test(url.pathname) || !url.search.slice(1)) {
    throw new Error("This is not a complete gw2skills.net editor build link.");
  }
  return url;
}

class ObjectLiteralParser {
  private index = 0;
  private readonly source: string;
  constructor(source: string) { this.source = source; }

  parse(): unknown {
    const value = this.value();
    this.space();
    if (this.index !== this.source.length) throw new Error("Unexpected content in gw2skills build payload.");
    return value;
  }

  private space() { while (/\s/.test(this.source[this.index] ?? "")) this.index += 1; }
  private peek() { this.space(); return this.source[this.index]; }
  private take(character: string) {
    this.space();
    if (this.source[this.index] !== character) throw new Error(`Expected ${character} in gw2skills build payload.`);
    this.index += 1;
  }
  private value(): unknown {
    const next = this.peek();
    if (next === "{") return this.object();
    if (next === "[") return this.array();
    if (next === '"' || next === "'") return this.string();
    if (next === "-" || /\d/.test(next ?? "")) return this.number();
    const identifier = this.identifier();
    if (identifier === "true") return true;
    if (identifier === "false") return false;
    if (identifier === "null") return null;
    throw new Error("Unsupported value in gw2skills build payload.");
  }
  private object(): JsonRecord {
    const result: JsonRecord = {};
    this.take("{");
    while (this.peek() !== "}") {
      const key = this.peek() === '"' || this.peek() === "'" ? this.string() : this.identifier(true);
      this.take(":");
      result[key] = this.value();
      if (this.peek() !== ",") break;
      this.take(",");
      if (this.peek() === "}") break;
    }
    this.take("}");
    return result;
  }
  private array(): unknown[] {
    const result: unknown[] = [];
    this.take("[");
    while (this.peek() !== "]") {
      result.push(this.value());
      if (this.peek() !== ",") break;
      this.take(",");
      if (this.peek() === "]") break;
    }
    this.take("]");
    return result;
  }
  private string(): string {
    this.space();
    const quote = this.source[this.index++];
    let result = "";
    while (this.index < this.source.length) {
      const character = this.source[this.index++];
      if (character === quote) return result;
      if (character !== "\\") { result += character; continue; }
      const escaped = this.source[this.index++];
      const simple: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "\\": "\\", "\"": "\"", "'": "'", "/": "/" };
      if (escaped === "u") {
        const hex = this.source.slice(this.index, this.index + 4);
        if (!/^[0-9a-f]{4}$/i.test(hex)) throw new Error("Invalid string escape in gw2skills build payload.");
        result += String.fromCharCode(Number.parseInt(hex, 16));
        this.index += 4;
      } else result += simple[escaped] ?? escaped;
    }
    throw new Error("Unterminated string in gw2skills build payload.");
  }
  private number(): number {
    this.space();
    const match = this.source.slice(this.index).match(/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
    if (!match) throw new Error("Invalid number in gw2skills build payload.");
    this.index += match[0].length;
    return Number(match[0]);
  }
  private identifier(allowNumeric = false): string {
    this.space();
    const pattern = allowNumeric ? /^[A-Za-z_$0-9][\w$-]*/ : /^[A-Za-z_$][\w$-]*/;
    const match = this.source.slice(this.index).match(pattern);
    if (!match) throw new Error("Invalid identifier in gw2skills build payload.");
    this.index += match[0].length;
    return match[0];
  }
}

function balancedObject(source: string, start: number): string {
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error("The gw2skills page did not contain a complete build payload.");
}

export function parseGw2SkillsPreload(html: string): JsonRecord {
  if (html.length > 3_000_000) throw new Error("The gw2skills response was unexpectedly large.");
  const match = /\bpreload\s*:/g.exec(html);
  if (!match) throw new Error("The gw2skills page did not contain a saved build.");
  const start = html.indexOf("{", match.index + match[0].length);
  if (start < 0) throw new Error("The gw2skills build payload was missing.");
  return record(new ObjectLiteralParser(balancedObject(html, start)).parse());
}

function rows(database: unknown, table: string): JsonRecord[] {
  const root = record(database);
  const candidates = [root[table], record(root.tables)[table], record(root.data)[table]];
  for (const candidate of candidates) {
    const value = record(candidate);
    const list = Array.isArray(candidate) ? candidate : value.rows;
    if (!Array.isArray(list)) continue;

    // The live gw2skills catalog stores each row as a compact positional
    // array and publishes its column names in `desc`. Keeping support for
    // object rows makes this boundary straightforward to fixture and also
    // tolerates a future expanded response without changing the importer.
    const columns = Array.isArray(value.desc) ? value.desc.map(stringValue) : [];
    return list.map((entry) => {
      if (!Array.isArray(entry)) return record(entry);
      return Object.fromEntries(columns.map((column, index) => [column, entry[index]]));
    });
  }
  return [];
}

function rowMap(database: unknown, table: string): Map<number, JsonRecord> {
  return new Map(rows(database, table).map((entry) => [numberValue(entry.id), entry]));
}

function displayName(value: JsonRecord): string {
  return stringValue(value.name) || stringValue(value.name_loc);
}

function superiorName(name: string, kind: "rune" | "sigil"): string {
  if (!name) return "";
  if (/^superior /i.test(name)) return name;
  return `Superior ${kind === "rune" ? "Rune" : "Sigil"} of ${name.replace(/^the\s+/i, "the ")}`;
}

function choiceIdForLabel(name: string, choices: readonly { label: string; id?: number }[]): string {
  const normalized = name.trim().toLowerCase();
  const match = choices.find((choice) => choice.label.toLowerCase() === normalized);
  return match?.id ? String(match.id) : "";
}

function infusionItemValue(name: string): string {
  const agony = name.match(/^\+(\d+) agony infusion$/i);
  if (agony) return String(49_423 + Number(agony[1]));
  return name;
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";
}

function normalizeStat(name: string, itemStatNames: string[]): string {
  const normalized = name.trim().toLowerCase().replace(/[’']/g, "").replace(/s$/, "");
  return itemStatNames.find((candidate) => candidate.toLowerCase().replace(/[’']/g, "").replace(/s$/, "") === normalized) ?? name;
}

export function applyGw2SkillsEquipment(
  builder: EntropyBuilderState,
  preload: JsonRecord,
  database: unknown,
  itemStatNames: string[],
): { state: EntropyBuilderState; warnings: string[] } {
  const state = structuredClone(builder);
  const equipment = record(preload.equipment);
  const profiles = rowMap(database, "profile");
  const profileTypes = rowMap(database, "prfltype");
  const upgrades = rowMap(database, "upgrade");
  const buffs = rowMap(database, "buff");
  const weapons = rowMap(database, "weapon");
  const warnings: string[] = [];
  const statBySlot: string[] = [];
  const statFor = (item: unknown) => {
    const profileId = numberValue(Array.isArray(item) ? item[0] : undefined);
    const typeId = numberValue(profiles.get(profileId)?.profile);
    return normalizeStat(displayName(profileTypes.get(typeId) ?? {}), itemStatNames);
  };
  const upgradeEntries = (entry: JsonRecord, field: "up" | "inf") => (Array.isArray(entry[field]) ? entry[field] : [])
    .map((value) => Array.isArray(value) ? upgrades.get(numberValue(value[0])) : undefined)
    .filter((value): value is JsonRecord => Boolean(value));
  const equipmentChoiceIds = (entry: JsonRecord, kind: "rune" | "sigil") => upgradeEntries(entry, "up")
    .map((value) => superiorName(displayName(value), kind))
    .map((name) => choiceIdForLabel(name, kind === "rune" ? BUILDER_RUNE_CHOICES : BUILDER_SIGIL_CHOICES) || name)
    .filter(Boolean);
  const infusionValues = (entry: JsonRecord) => upgradeEntries(entry, "inf")
    .map((value) => infusionItemValue(displayName(value)))
    .filter(Boolean);
  const recordUnresolvedInfusions = (values: string[]) => {
    const unresolved = values.filter((value) => !/^\d+$/.test(value));
    if (unresolved.length && !warnings.some((warning) => warning.startsWith("Some imported infusions"))) {
      warnings.push("Some imported infusions do not expose official item IDs in the source catalog. Their names remain saved in this draft, but the current AxiCode format cannot export those exact infusion entries.");
    }
  };

  const armorSlots: Record<string, keyof typeof state.equipment.runes> = {
    helm: "head", shoulders: "shoulders", coat: "chest", gloves: "hands", leggings: "legs", boots: "feet",
  };
  const armor = record(equipment.armor);
  for (const [sourceSlot, targetSlot] of Object.entries(armorSlots)) {
    const entry = record(armor[sourceSlot]);
    const stat = statFor(entry.item);
    if (stat) statBySlot.push(stat);
    state.equipment.runes[targetSlot] = equipmentChoiceIds(entry, "rune")[0] ?? "";
    const infusions = infusionValues(entry);
    recordUnresolvedInfusions(infusions);
    if (infusions[0]) state.equipment.infusions[targetSlot] = infusions[0];
  }

  const weaponSlots: Record<string, keyof typeof state.equipment.weapons> = {
    w11: "mainhand1", w12: "offhand1", w21: "mainhand2", w22: "offhand2", w31: "aquatic1", w32: "aquatic2",
  };
  const weaponEquipment = record(equipment.weapon);
  const weaponIds = Array.isArray(preload.weapon) ? preload.weapon : [];
  for (const [sourceSlot, targetSlot] of Object.entries(weaponSlots)) {
    const index = ["w11", "w12", "w21", "w22", "w31", "w32"].indexOf(sourceSlot);
    const weaponName = displayName(weapons.get(numberValue(weaponIds[index])) ?? {}).toLowerCase();
    if (weaponName) state.equipment.weapons[targetSlot] = weaponName;
    const entry = record(weaponEquipment[sourceSlot]);
    const stat = statFor(entry.item);
    if (stat) statBySlot.push(stat);
    state.equipment.sigils[targetSlot] = equipmentChoiceIds(entry, "sigil");
    const infusions = infusionValues(entry);
    recordUnresolvedInfusions(infusions);
    if (infusions.length) state.equipment.infusions[targetSlot] = infusions;
  }

  const trinkets = record(equipment.trinket);
  const trinketSlots: Record<string, string> = {
    back: "backpack",
    amulet: "amulet",
    ring1: "ring1",
    ring2: "ring2",
    earring1: "accessory1",
    earring2: "accessory2",
    accessory1: "accessory1",
    accessory2: "accessory2",
  };
  for (const [sourceSlot, targetSlot] of Object.entries(trinketSlots)) {
    const entry = record(trinkets[sourceSlot]);
    if (!Object.keys(entry).length || state.equipment.slots[targetSlot]) continue;
    const stat = statFor(entry.item);
    if (stat) {
      statBySlot.push(stat);
      state.equipment.slots[targetSlot] = `${stat} stats`;
    }
    const infusions = infusionValues(entry);
    recordUnresolvedInfusions(infusions);
    if (infusions.length) {
      state.equipment.infusions[targetSlot] = targetSlot === "accessory1" || targetSlot === "accessory2"
        ? infusions[0]
        : infusions;
    }
  }

  const enrichmentName = displayName(upgradeEntries(record(trinkets.amulet), "up")[0] ?? {});
  if (enrichmentName) {
    state.equipment.enrichment = choiceIdForLabel(enrichmentName, BUILDER_ENRICHMENT_CHOICES) || enrichmentName;
    if (!/^\d+$/.test(state.equipment.enrichment)) {
      warnings.push("The imported enrichment name was preserved, but its official item ID was not available in the source catalog and cannot be exported by the current AxiCode format.");
    }
  }

  state.equipment.statPackage = mostCommon(statBySlot);
  const distinctStats = [...new Set(statBySlot)];
  if (distinctStats.length > 1) {
    warnings.push(`Mixed stat gear was preserved in the import summary (${distinctStats.join(", ")}); Entropy's current editor exposes one primary stat package.`);
    state.notes = [state.notes, `Imported mixed stat profiles: ${distinctStats.join(", ")}.`].filter(Boolean).join("\n");
  }

  const relic = upgrades.get(numberValue(equipment.relic));
  state.equipment.relic = displayName(relic ?? {});
  const consumables = record(equipment.buff);
  state.equipment.food = displayName(buffs.get(numberValue(consumables.food)) ?? {});
  state.equipment.utility = displayName(buffs.get(numberValue(consumables.utility)) ?? {});
  return { state, warnings };
}

function databaseFileFromHtml(html: string, pageUrl: URL): string {
  const explicit = html.match(/(?:ajax\/db\/)?([a-z]{2}\.[0-9]+\.json)/i)?.[1];
  if (explicit) return explicit;

  const databaseId = html.match(/\bdbid\s*:\s*([0-9]+)/i)?.[1];
  if (!databaseId) throw new Error("The gw2skills catalog version could not be identified.");
  const language = /^[a-z]{2}$/i.test(pageUrl.hostname.split(".")[0] ?? "")
    ? pageUrl.hostname.split(".")[0].toLowerCase()
    : "en";
  return `${language}.${databaseId}.json`;
}

async function fetchImportSource(url: URL): Promise<{ html: string; database: unknown }> {
  if (isTauriRuntime()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const value = record(await invoke("fetch_gw2skills_import_source", { url: url.href }));
    if (typeof value.html !== "string" || !value.database) {
      throw new Error("The desktop importer received an incomplete gw2skills response.");
    }
    return { html: value.html, database: value.database };
  }

  const useProxy = typeof window !== "undefined" && /^https?:$/.test(window.location.protocol);
  if (useProxy) {
    let response: Response | undefined;
    try {
      response = await fetch(`/api/gw2skills-import?url=${encodeURIComponent(url.href)}`);
    } catch {
      // A plain local Vite preview has no deployment function. The direct
      // fallback below remains useful when the source permits browser CORS.
    }
    if (response?.ok) {
      try {
        const value = record(await response.json());
        if (typeof value.html === "string" && value.database) return { html: value.html, database: value.database };
      } catch {
        // A local SPA fallback can return index.html with a 200 status.
      }
    } else if (response && response.status !== 404) {
      const value = record(await response.json().catch(() => ({})));
      throw new Error(stringValue(value.error) || `The web import service returned ${response.status}.`);
    }
  }
  const page = await fetch(url.href);
  if (!page.ok) throw new Error(`gw2skills.net returned ${page.status}.`);
  const html = await page.text();
  const resolvedPageUrl = validateGw2SkillsEditorUrl(page.url || url.href);
  const databaseResponse = await fetch(new URL(`/ajax/db/${databaseFileFromHtml(html, resolvedPageUrl)}`, resolvedPageUrl.origin));
  if (!databaseResponse.ok) throw new Error("The gw2skills item catalog could not be loaded.");
  return { html, database: await databaseResponse.json() };
}

export async function importGw2SkillsBuild(
  input: string,
  options: { itemStatNames: string[]; legends: Gw2Legend[] },
): Promise<Gw2SkillsImportResult> {
  const url = validateGw2SkillsEditorUrl(input);
  const { html, database } = await fetchImportSource(url);
  const preload = parseGw2SkillsPreload(html);
  const chatCode = stringValue(preload.chatlink);
  if (!chatCode) throw new Error("The gw2skills build did not include a GW2 build template.");
  const profession = professionFromBuildChatCode(chatCode);
  const paletteBySkill = await fetchGw2ProfessionSkillPalette(profession);
  const builder = decodeBuildChatCode(chatCode, {
    skillIdByPalette: new Map([...paletteBySkill].map(([skillId, paletteId]) => [paletteId, skillId])),
    legendIdByCode: new Map(options.legends.filter((legend) => legend.code).map((legend) => [legend.code!, legend.id])),
  });
  builder.gameMode = preload.mode === "pve" || preload.mode === "pvp" || preload.mode === "wvw" ? preload.mode : "wvw";
  builder.name = "Imported gw2skills Build";
  const withEquipment = applyGw2SkillsEquipment(builder, preload, database, options.itemStatNames);
  return { state: withEquipment.state, warnings: withEquipment.warnings, sourceUrl: url.href };
}
