export type ViewTone = "overview" | "squad" | "performance" | "combat" | "extras";

export interface ViewRegistryItem {
  id: string;
  label: string;
  keywords?: string[];
  requiresReport?: boolean;
}

export interface ViewRegistrySection {
  title: string;
  tone: ViewTone;
  items: ViewRegistryItem[];
  flat?: boolean;
}

export const VIEW_SECTIONS: ViewRegistrySection[] = [
  {
    title: "OVERVIEW",
    tone: "overview",
    items: [
      { id: "overview", label: "Overview", keywords: ["summary", "night", "landing"] },
      { id: "kdr", label: "KDR", keywords: ["kills", "deaths", "record"] },
      { id: "fight-breakdown", label: "Fight Breakdown", keywords: ["fights", "per fight"] },
      { id: "map-distribution", label: "Map Distribution", keywords: ["map", "borderland", "ebg"] },
      { id: "classes", label: "Classes", keywords: ["profession", "specialization", "comp"] },
      { id: "composition", label: "Composition", keywords: ["parties", "squad comp", "roles"] },
    ],
  },
  {
    title: "SQUAD & ROSTER",
    tone: "squad",
    items: [
      { id: "squad-stats", label: "Squad Stats", keywords: ["kill pressure", "healing effectiveness", "tag distance"] },
      { id: "roster", label: "Roster Intel", keywords: ["attendance", "raid roster"] },
      { id: "commander-stats", label: "Commander Stats & Highlights", keywords: ["tag", "lead", "highlights", "moments"] },
      { id: "player-profiles", label: "Player Profiles", keywords: ["career", "history"] },
    ],
  },
  {
    title: "PERFORMANCE",
    tone: "performance",
    items: [
      { id: "top-players", label: "Top Players", keywords: ["mvp", "damage", "healing", "barrier"] },
      { id: "player-compare", label: "Player Compare", keywords: ["players", "versus", "duel", "head to head", "night"] },
      { id: "top-skills", label: "Top Skills", keywords: ["skill damage", "skill healing"] },
      { id: "offensive", label: "Offensive Stats", keywords: ["downs", "kills", "strips"] },
      { id: "defensive", label: "Defensive Stats", keywords: ["mitigation", "blocks", "healing"] },
      { id: "damage-modifiers", label: "Damage Modifiers", keywords: ["modifier", "crit"] },
      { id: "rotations", label: "Rotations", keywords: ["apm", "casts"] },
      { id: "buffs", label: "Buffs", keywords: ["uptime", "boons", "conditions", "stability"] },
      { id: "buff-generation", label: "Buff Generation", keywords: ["boon generation", "cleanse", "stability", "quickness"] },
      { id: "party-boons", label: "Party Boons", keywords: ["subgroup", "party", "group boons"] },
      { id: "conditions", label: "Conditions", keywords: ["debuff", "bleed", "burning", "cripple", "weakness", "vulnerability", "condi damage"] },
    ],
  },
  {
    title: "COMBAT LOG",
    tone: "combat",
    items: [
      { id: "dps-graph", label: "DPS Graph" },
      { id: "fight-replay", label: "Fight Replay" },
      { id: "mechanics", label: "Mechanics Timeline" },
      { id: "death-recap", label: "Death Recap" },
    ],
  },
  {
    title: "INTELLIGENCE",
    tone: "extras",
    flat: true,
    items: [
      { id: "intelligence", label: "Intelligence", keywords: ["ml", "predictive", "findings"] },
    ],
  },
  {
    title: "ARCHIVE",
    tone: "extras",
    flat: true,
    items: [
      { id: "archive", label: "Report Archive", keywords: ["history", "saved"], requiresReport: false },
      { id: "compare", label: "Compare Reports", keywords: ["diff", "reports"], requiresReport: false },
    ],
  },
  {
    title: "TOOLS",
    tone: "extras",
    flat: true,
    items: [
      { id: "axiforge-lab", label: "Entropy Builder", keywords: ["builder", "build editor", "tools"], requiresReport: false },
    ],
  },
];

export const VIEW_TITLES: Record<string, string> = Object.fromEntries(
  VIEW_SECTIONS.flatMap((section) => section.items.map((item) => [item.id, item.label])),
);

export const VIEW_TONES: Record<string, ViewTone> = Object.fromEntries(
  VIEW_SECTIONS.flatMap((section) => section.items.map((item) => [item.id, section.tone])),
) as Record<string, ViewTone>;

export const KNOWN_VIEW_IDS = [...VIEW_SECTIONS.flatMap((section) => section.items.map((item) => item.id)), "highlights"] as const;

VIEW_TITLES.highlights = "Commander Stats & Highlights";
VIEW_TONES.highlights = "squad";

export function viewLabel(view: string) {
  return VIEW_TITLES[view] ?? view.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
