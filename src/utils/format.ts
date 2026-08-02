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
  Warrior: "warrior", Berserker: "warrior", Spellbreaker: "warrior", Bladesworn: "warrior",
  // Revenant
  Revenant: "revenant", Herald: "revenant", Renegade: "revenant", Vindicator: "revenant",
  // Engineer
  Engineer: "engineer", Scrapper: "engineer", Holosmith: "engineer", Mechanist: "engineer",
  // Ranger
  Ranger: "ranger", Druid: "ranger", Soulbeast: "ranger", Untamed: "ranger",
  // Thief
  Thief: "thief", Daredevil: "thief", Deadeye: "thief", Specter: "thief",
  // Elementalist
  Elementalist: "elementalist", Tempest: "elementalist", Weaver: "elementalist", Catalyst: "elementalist",
  // Necromancer
  Necromancer: "necro", Reaper: "necro", Scourge: "necro", Harbinger: "necro",
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

export function profIcon(profession: string): string {
  const fam = PROFESSION_FAMILY[profession] ?? "default";
  return PROFESSION_ICONS[fam] ?? "";
}
