// Formatting + profession styling helpers for WvW report views.
import { classIconSrc } from "../data/classIconAssets";

/**
 * Color tier for an intensity-stacking buff value (avg stacks held), relative to
 * the other values in the SAME column.
 *
 * Duration buffs have a natural 0-100% scale, so a fixed threshold (see
 * `uptimeColor` in BuffsView) makes sense: 90%+ is good regardless of which buff
 * it is. Stacking buffs don't share a scale - Might caps at 25 stacks, most
 * conditions have no practical cap, Stability is usually 0-3. A fixed threshold
 * would show a strong Might uptime as "bad" and a middling condition stack as
 * "great" for no real reason, which is what made this look wrong.
 *
 * Instead this ranks each value against the other non-zero values Elite Insights
 * reported for that exact buff in this report, so "good" always means "better
 * than your squadmates on this specific buff" rather than an arbitrary number.
 * Never invents a cap that isn't in the source data.
 */
export function relativeStackColor(value: number | undefined, columnValues: Array<number | undefined>): string {
    if (value === undefined || value <= 0) return "text-slate-600";
    const nonZero = columnValues.filter((v): v is number => typeof v === "number" && v > 0).sort((a, b) => a - b);
    if (nonZero.length <= 1) return "text-emerald-400";
    const rank = nonZero.filter((v) => v <= value).length / nonZero.length;
    if (rank >= 0.8) return "text-emerald-400";
    if (rank >= 0.4) return "text-amber-400";
    return "text-orange-400/80";
}

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

// Profession -> Entropy class-icon color family. Elite specs inherit their base
// profession color so text chips line up with the bundled square class icons.
export const PROFESSION_FAMILY: Record<string, string> = {
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
    warrior: { bg: "bg-yellow-950/50", text: "text-yellow-400", border: "border-yellow-500/30", dot: "bg-yellow-400" },
    revenant: { bg: "bg-red-950/50", text: "text-red-500", border: "border-red-700/40", dot: "bg-red-700" },
    engineer: { bg: "bg-orange-950/50", text: "text-orange-400", border: "border-orange-500/30", dot: "bg-orange-400" },
    ranger: { bg: "bg-lime-950/50", text: "text-lime-400", border: "border-lime-500/30", dot: "bg-lime-400" },
    thief: { bg: "bg-rose-950/50", text: "text-rose-300", border: "border-rose-400/30", dot: "bg-rose-300" },
    elementalist: { bg: "bg-red-950/50", text: "text-red-400", border: "border-red-500/30", dot: "bg-red-400" },
    necro: { bg: "bg-green-950/50", text: "text-green-400", border: "border-green-500/30", dot: "bg-green-400" },
    mesmer: { bg: "bg-fuchsia-950/50", text: "text-fuchsia-400", border: "border-fuchsia-500/30", dot: "bg-fuchsia-400" },
  default: { bg: "bg-slate-800/40", text: "text-slate-300", border: "border-slate-600/30", dot: "bg-slate-400" },
};

export function normalizeProfessionLabel(profession: string | undefined | null): string {
    return String(profession ?? "")
        .replace(/\s*\([^)]*\)\s*$/, "")
        .replace(/\s*\[[^\]]*\]\s*$/, "")
        .trim();
}

export function profStyle(profession: string) {
    const normalized = normalizeProfessionLabel(profession);
    const fam = PROFESSION_FAMILY[normalized] ?? PROFESSION_FAMILY[profession] ?? "default";
    return PROFESSION_COLORS[fam] ?? PROFESSION_COLORS.default;
}

export function profChip(profession: string): string {
    const s = profStyle(profession);
    return `theme-profession-chip ${s.bg} ${s.text} ${s.border}`;
}

export function profIcon(profession: string): string {
    return classIconSrc(profession);
}
