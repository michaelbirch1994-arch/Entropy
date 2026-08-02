// Formatting + profession styling helpers for WvW report views.

export function fmtNum(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

export function fmtCompact(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}m`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString("en-US");
}

export function fmtFixed(n: number | string | undefined | null, digits: number = 2): string {
  if (n === undefined || n === null) return "—";
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (Number.isNaN(v)) return "—";
  if (!Number.isFinite(v)) return "∞";
  return v.toFixed(digits);
}

/** Like fmtFixed, but with thousands separators (e.g. 22319.00 -> "22,319.00"). */
export function fmtFixedGrouped(n: number | string | undefined | null, digits: number = 2): string {
  if (n === undefined || n === null) return "—";
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (Number.isNaN(v)) return "—";
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPct(n: number | undefined | null, digits = 0): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function fmtDur(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function fmtPerSec(value: number, activeMs: number): number {
  if (!activeMs) return 0;
  return value / (activeMs / 1000);
}

// Profession -> GW2 armor weight / color family.
// Guardian (blue), Warrior (orange), Revenant (green), Engineer (teal),
// Ranger (green), Thief (brown), Elementalist (red), Necromancer (green),
// Mesmer (pink). Elite specs inherit.
const PROFESSION_FAMILY: Record<string, string> = {
  // Guardian
  Guardian: "guardian", Dragonhunter: "guardian", Firebrand: "guardian", Willbender: "guardian", Luminary: "guardian",
  // Warrior
  Warrior: "warrior", Berserker: "warrior", Spellbreaker: "warrior", Bladesworn: "warrior", Paragon: "warrior",
  // Revenant
  Revenant: "revenant", Herald: "revenant", Renegade: "revenant", Vindicator: "revenant", Conduit: "revenant",
  // Engineer
  Engineer: "engineer", Scrapper: "engineer", Holosmith: "engineer", Mechanist: "engineer", Amalgam: "engineer",
  // Ranger
  Ranger: "ranger", Druid: "ranger", Soulbeast: "ranger", Untamed: "ranger", Galeshot: "ranger",
  // Thief
  Thief: "thief", Daredevil: "thief", Deadeye: "thief", Specter: "thief", Antiquary: "thief",
  // Elementalist
  Elementalist: "elementalist", Tempest: "elementalist", Weaver: "elementalist", Catalyst: "elementalist", Evoker: "elementalist",
  // Necromancer
  Necromancer: "necro", Reaper: "necro", Scourge: "necro", Harbinger: "necro", Ritualist: "necro",
  // Mesmer
  Mesmer: "mesmer", Chronomancer: "mesmer", Mirage: "mesmer", Virtuoso: "mesmer", Troubadour: "mesmer",
};

export const PROFESSION_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  guardian: { bg: "bg-sky-950/50", text: "text-sky-400", border: "border-sky-500/30", dot: "bg-sky-400" },
  warrior: { bg: "bg-orange-950/50", text: "text-orange-400", border: "border-orange-500/30", dot: "bg-orange-400" },
  revenant: { bg: "bg-emerald-950/50", text: "text-emerald-400", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  engineer: { bg: "bg-teal-950/50", text: "text-teal-400", border: "border-teal-500/30", dot: "bg-teal-400" },
  ranger: { bg: "bg-lime-950/50", text: "text-lime-400", border: "border-lime-500/30", dot: "bg-lime-400" },
  thief: { bg: "bg-amber-950/50", text: "text-amber-400", border: "border-amber-500/30", dot: "bg-amber-400" },
  elementalist: { bg: "bg-red-950/50", text: "text-red-400", border: "border-red-500/30", dot: "bg-red-400" },
  necro: { bg: "bg-green-950/50", text: "text-green-400", border: "border-green-500/30", dot: "bg-green-400" },
  mesmer: { bg: "bg-fuchsia-950/50", text: "text-fuchsia-400", border: "border-fuchsia-500/30", dot: "bg-fuchsia-400" },
  default: { bg: "bg-slate-800/40", text: "text-slate-300", border: "border-slate-600/30", dot: "bg-slate-400" },
};

export function profStyle(profession: string) {
  const fam = PROFESSION_FAMILY[profession] ?? "default";
  return PROFESSION_COLORS[fam] ?? PROFESSION_COLORS.default;
}

export function profChip(profession: string): string {
  const s = profStyle(profession);
  return `${s.bg} ${s.text} ${s.border}`;
}

// Real GW2 base-profession icons (from api.guildwars2.com/v2/professions).
// Elite specs map down to their base profession family via PROFESSION_FAMILY.
export const PROFESSION_ICONS: Record<string, string> = {
  guardian: "https://render.guildwars2.com/file/C32BE61FC55C962524624F643897ECF1A9C80462/156634.png",
  warrior: "https://render.guildwars2.com/file/0A97E13F29B3597A447EEC04A09BE5BD699A2250/156643.png",
  revenant: "https://render.guildwars2.com/file/7C9309BE7A2A48C6A9FBCC70CC1EBEBFD7593C05/961390.png",
  engineer: "https://render.guildwars2.com/file/5CCB361F44CCC7256132405D31E3A24DACCF440A/156632.png",
  ranger: "https://render.guildwars2.com/file/49B10316B424F4E20139EB5E51ADCF24A8724E9B/156640.png",
  thief: "https://render.guildwars2.com/file/F9EC00E23F630D6DB20CDA985592EC010E2A5705/156641.png",
  elementalist: "https://render.guildwars2.com/file/77B793123251931AFF9FCA24C07E0F704BC4DA49/156630.png",
  necro: "https://render.guildwars2.com/file/AE56F8670807B87CF6EEE3FC7E6CB9710959E004/156638.png",
  mesmer: "https://render.guildwars2.com/file/E43730AD49A903C3A1B4F27E41DE04EA51A775EC/156636.png",
  default: "",
};

// Real GW2 elite-specialization icons (from api.guildwars2.com/v2/specializations,
// filtered to elite:true). Distinct per sub-class rather than falling back to the
// shared base-profession icon - e.g. Firebrand and Willbender each get their own art.
const PROFESSION_ELITE_ICONS: Record<string, string> = {
  Dragonhunter: "https://render.guildwars2.com/file/736DB02E6DA2ACFAD3B9B0F4655113AD214FFA40/1011994.png",
  Firebrand: "https://render.guildwars2.com/file/6D18B2D3EE0BFA0E4BC851A7D3C39D4330250916/1769890.png",
  Willbender: "https://render.guildwars2.com/file/117F4659C3AD0AF6625D51013F03D541BEF2E8A6/2479302.png",
  Luminary: "https://render.guildwars2.com/file/034C203DBD60CFF19D3D5CE9E71B27CA0103F50D/3679898.png",
  Berserker: "https://render.guildwars2.com/file/B706475993F16D0BD7DFDF3BB30AA144051CDC94/1029935.png",
  Spellbreaker: "https://render.guildwars2.com/file/06DFB7E3F267ADD0BB43C7383251343858371D02/1769896.png",
  Bladesworn: "https://render.guildwars2.com/file/9D0ADEDFDEACCCD2B27103A944B1E7F6C21DCBE2/2491509.png",
  Paragon: "https://render.guildwars2.com/file/B915D599CB40733130F7121B5CDE0BE42ED9E06C/3679904.png",
  Herald: "https://render.guildwars2.com/file/78496E9E95C46527F8E0B974530A07A017DC9B79/1058520.png",
  Renegade: "https://render.guildwars2.com/file/0152279F7DD0FCFA21F2D1CC17DE21B2BD58EFF3/1769894.png",
  Vindicator: "https://render.guildwars2.com/file/4FE40FD1ECD6C4EC45A32A2A740AC2E2A147E04F/2491508.png",
  Conduit: "https://render.guildwars2.com/file/63DD70A26845681B9B993A51987F60A2F7970C52/3679902.png",
  Scrapper: "https://render.guildwars2.com/file/FEB1B8C559DDB5A04F9C0579F741080259FEF841/1011991.png",
  Holosmith: "https://render.guildwars2.com/file/F41CDEE4603FC0741669A7F2A7E977D36123DF7C/1769889.png",
  Mechanist: "https://render.guildwars2.com/file/F86CDF34404C0B5A01CD0CBB9D7D0DC1D8CC48CF/2503608.png",
  Amalgam: "https://render.guildwars2.com/file/67AA599996662C5BA8427FA7BA6FF8B4ED221B0D/3679897.png",
  Druid: "https://render.guildwars2.com/file/BE10CB10D8446208729934F3F1BD3A54BEED9AD6/1012013.png",
  Soulbeast: "https://render.guildwars2.com/file/0AA4A2C62C4F2D0E0D59DBEE9C63EB4AF472F0C5/1769893.png",
  Untamed: "https://render.guildwars2.com/file/D219A813B5312BA9D1D10A74C10E9E5F3F54936B/2503609.png",
  Galeshot: "https://render.guildwars2.com/file/1E0DE9DF219380B3DD15AD35466461C935930515/3679901.png",
  Daredevil: "https://render.guildwars2.com/file/F1985D4E1CE043D7145E030C0AC4CFDABED73A59/1012025.png",
  Deadeye: "https://render.guildwars2.com/file/F93EF1717238E9ACC1CA330D4416D324AE08585D/1769895.png",
  Specter: "https://render.guildwars2.com/file/E915E494C64037C93AB53FB6F2D414B468DBCA48/2503610.png",
  Antiquary: "https://render.guildwars2.com/file/569D3C9A9E7121939844809F0D05E81480C8F6F8/3679903.png",
  Tempest: "https://render.guildwars2.com/file/D1970ABC09D07B4275C7E47DDD0EDC0F4CFC050C/1029930.png",
  Weaver: "https://render.guildwars2.com/file/02FAA82BF2F5BF3E3AD89BCF05FF56B4C86139F4/1769888.png",
  Catalyst: "https://render.guildwars2.com/file/1DF8CD361899081107B504A02B01C9B3B3645970/2491507.png",
  Evoker: "https://render.guildwars2.com/file/A80E0721636B027711E408BF0ADFDCD3330920AA/3679896.png",
  Reaper: "https://render.guildwars2.com/file/530A582BD864B73AF5CC6C44F9C61954322D9A15/1012009.png",
  Scourge: "https://render.guildwars2.com/file/1407ADE7787A6BF6E457F5FA6DFA1062A5FA93FD/1769892.png",
  Harbinger: "https://render.guildwars2.com/file/75B05DF5ED51D0153838EC134CEFCFC80D97DA0E/2479304.png",
  Ritualist: "https://render.guildwars2.com/file/9064C22D08E4A7686FFB0256DDF42B97055EB144/3679900.png",
  Chronomancer: "https://render.guildwars2.com/file/D9C960059A69F4DB6604DAD6AF06D0F940E76754/1012001.png",
  Mirage: "https://render.guildwars2.com/file/6403ECA8E6C1683E2C9D075A39C154ED3A7C04A1/1769891.png",
  Virtuoso: "https://render.guildwars2.com/file/7B0F5E48320F35C0C6A2013ACF63F4C17B1105A5/2479303.png",
  Troubadour: "https://render.guildwars2.com/file/0FDD99E8B7A7FB4B06186C0756E02C0515520F75/3679899.png",
};

export function profIcon(profession: string): string {
  if (PROFESSION_ELITE_ICONS[profession]) return PROFESSION_ELITE_ICONS[profession];
  const fam = PROFESSION_FAMILY[profession] ?? "default";
  return PROFESSION_ICONS[fam] ?? "";
}
