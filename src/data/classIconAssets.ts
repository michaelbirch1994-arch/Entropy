const CLASS_ICON_BASE = "/images/class-icons";

export const CLASS_ICON_FILE_BY_NAME: Record<string, string> = {
  Amalgam: "Amalgam_0000_Square_384.png",
  Antiquary: "Antiquary (2026)_0000_Square_384.png",
  Berserker: "Berserker_0000_Square_384.png",
  Bladesworn: "Bladesworn_0000_Square_384.png",
  Catalyst: "Catalyst_0000_Square_384.png",
  Chronomancer: "Chronomancer_0000_Square_384.png",
  Conduit: "Conduit_0000_Square_384.png",
  Daredevil: "Daredevil_0000_Square_384.png",
  Deadeye: "Deadeye_0000_Square_384.png",
  Dragonhunter: "Dragonhunter_0000_Square_384.png",
  Druid: "Druid_0000_Square_384.png",
  Elementalist: "Elementalist_0000_Square_384.png",
  Engineer: "Engineer_0000_Square_384.png",
  Evoker: "Evoker_0000_Square_384.png",
  Firebrand: "Firebrand_0000_Square_384.png",
  Galeshot: "Galeshot_0000_Square_384.png",
  Guardian: "Guardian_0000_Square_384.png",
  Harbinger: "Harbinger_0000_Square_384.png",
  Herald: "Herald_0000_Square_384.png",
  Holosmith: "Holosmith_0000_Square_384.png",
  Luminary: "Luminary (2026)_0000_Square_384.png",
  Mechanist: "Mechanist_0000_Square_384.png",
  Mesmer: "Mesmer_0000_Square_384.png",
  Mirage: "Mirage_0000_Square_384.png",
  Necromancer: "Necromancer_0000_Square_384.png",
  Paragon: "Paragon_0000_Square_384.png",
  Ranger: "Ranger_0000_Square_384.png",
  Reaper: "Reaper_0000_Square_384.png",
  Renegade: "Renegade_0000_Square_384.png",
  Revenant: "Revenant_0000_Square_384.png",
  Ritualist: "Ritualist_0000_Square_384.png",
  Scourge: "Scourge_0000_Square_384.png",
  Scrapper: "Scrapper_0000_Square_384.png",
  Soulbeast: "Soulbeast_0000_Square_384.png",
  Specter: "Specter_0000_Square_384.png",
  Spellbreaker: "Spellbreaker_0000_Square_384.png",
  Tempest: "Tempest_0000_Square_384.png",
  Thief: "Thief_0000_Square_384.png",
  Troubadour: "Troubadour_0000_Square_384.png",
  Untamed: "Untamed_0000_Square_384.png",
  Vindicator: "Vindicator_0000_Square_384.png",
  Virtuoso: "Virtuoso_0000_Square_384.png",
  Warrior: "Warrior_0000_Square_384.png",
  Weaver: "Weaver_0000_Square_384.png",
  Willbender: "Willbender_0000_Square_384.png",
};

const NORMALIZED_CLASS_ICON_FILES = Object.fromEntries(
  Object.entries(CLASS_ICON_FILE_BY_NAME).map(([name, file]) => [normalizeClassIconName(name), file]),
);

const CLASS_ICON_ALIASES: Record<string, string> = {
  necro: "Necromancer",
  coreguardian: "Guardian",
  corewarrior: "Warrior",
  corerevenant: "Revenant",
  coreengineer: "Engineer",
  coreranger: "Ranger",
  corethief: "Thief",
  coreelementalist: "Elementalist",
  corenecromancer: "Necromancer",
  coremesmer: "Mesmer",
};

export function normalizeClassIconName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function classIconSrc(name: string | undefined | null): string {
  if (!name) return "";
  const normalized = normalizeClassIconName(name);
  const aliased = CLASS_ICON_ALIASES[normalized];
  const file = NORMALIZED_CLASS_ICON_FILES[normalized] ?? (aliased ? CLASS_ICON_FILE_BY_NAME[aliased] : "");
  return file ? `${CLASS_ICON_BASE}/${encodeURIComponent(file)}` : "";
}
