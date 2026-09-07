import type { Gw2ApiFact, Gw2Skill, Gw2Trait } from "../../types/buildEditor";

export const BUILD_UTILITY_ORDER = [
  "cleanse",
  "stunBreak",
  "boonRemoval",
  "healing",
  "barrier",
  "projectileDefense",
  "reflect",
  "crowdControl",
  "revive",
  "stealth",
  "superspeed",
] as const;

export type BuildUtilityKind = typeof BUILD_UTILITY_ORDER[number];

export const BUILD_UTILITY_LABELS: Record<BuildUtilityKind, string> = {
  cleanse: "Condition Cleanse",
  stunBreak: "Stun Break",
  boonRemoval: "Boon Removal",
  healing: "Group Healing",
  barrier: "Barrier",
  projectileDefense: "Projectile Defense",
  reflect: "Projectile Reflect",
  crowdControl: "Crowd Control",
  revive: "Revive Support",
  stealth: "Stealth",
  superspeed: "Superspeed",
};

export interface BuildUtilitySource {
  type: "skill" | "trait";
  sourceName: string;
  icon?: string;
  recharge?: number;
}

export interface BuildUtilityEntry {
  kind: BuildUtilityKind;
  label: string;
  sources: BuildUtilitySource[];
  icon?: string;
}

interface UtilityEntity {
  name: string;
  icon?: string;
  description?: string;
  facts?: Gw2ApiFact[];
}

function factText(facts: Gw2ApiFact[]): string {
  return facts.map((fact) => [fact.text, fact.status, fact.description, fact.type].filter(Boolean).join(" ")).join(" ").toLowerCase();
}

function detectsUtility(kind: BuildUtilityKind, entity: UtilityEntity): boolean {
  const description = (entity.description ?? "").toLowerCase();
  const facts = factText(entity.facts ?? []);
  switch (kind) {
    case "cleanse":
      return /conditions? (?:removed|converted)/.test(facts) || /(?:remove|removes|cure|cures|cleanse|cleanses|convert|converts) (?:\w+ )?conditions?/.test(description);
    case "stunBreak":
      return /breaks? stuns?|stun break/.test(description + " " + facts);
    case "boonRemoval":
      return /boons? removed/.test(facts) || /(?:remove|removes|strip|strips|rip|rips|corrupt|corrupts) (?:\w+ )?boons?/.test(description);
    case "healing":
      return /\bhealing\b/.test(facts) && /\b(?:alli(?:es|ed)|nearby|area|targets?)\b/.test(description + " " + facts);
    case "barrier":
      return /\bbarrier\b/.test(facts) || /(?:grant|grants|apply|applies) (?:\w+ )?barrier/.test(description);
    case "projectileDefense":
      return /blocks? missiles?/.test(facts) || /(?:block|blocks|destroy|destroys|absorb|absorbs) (?:\w+ )?(?:projectiles?|missiles?)/.test(description);
    case "reflect":
      return /reflects? (?:\w+ )?(?:projectiles?|missiles?)/.test(description + " " + facts);
    case "crowdControl":
      return /defiance break/.test(facts) || /\b(?:knock(?:s|ed)? (?:back|down)|push(?:es)?|pull(?:s)?|launch(?:es)?|stun(?:s|ned)?|daze(?:s|d)?|float(?:s|ed)?|sink(?:s|ed)?)\b/.test(
        description.replace(/breaks? stuns?/g, ""),
      );
    case "revive":
      return /revive percentage/.test(facts) || /\b(?:revive|revives|reviving)\b/.test(description);
    case "stealth":
      return /\bstealth\b/.test(facts) || /(?:grant|grants|apply|applies) (?:\w+ )?stealth/.test(description);
    case "superspeed":
      return /\bsuperspeed\b/.test(facts) || /(?:grant|grants|apply|applies) (?:\w+ )?superspeed/.test(description);
  }
}

function recharge(facts: Gw2ApiFact[]): number | undefined {
  return facts.find((fact) => fact.type === "Recharge")?.value;
}

export function analyzeBuildUtility(skills: Gw2Skill[], traits: Gw2Trait[]): BuildUtilityEntry[] {
  const entries = new Map<BuildUtilityKind, BuildUtilityEntry>();
  const scan = (entity: UtilityEntity, type: "skill" | "trait") => {
    for (const kind of BUILD_UTILITY_ORDER) {
      if (!detectsUtility(kind, entity)) continue;
      const entry = entries.get(kind) ?? { kind, label: BUILD_UTILITY_LABELS[kind], sources: [], icon: entity.icon };
      if (!entry.sources.some((source) => source.type === type && source.sourceName === entity.name)) {
        entry.sources.push({ type, sourceName: entity.name, icon: entity.icon, recharge: recharge(entity.facts ?? []) });
      }
      if (!entry.icon && entity.icon) entry.icon = entity.icon;
      entries.set(kind, entry);
    }
  };
  skills.forEach((skill) => scan(skill, "skill"));
  traits.forEach((trait) => scan(trait, "trait"));
  return BUILD_UTILITY_ORDER.map((kind) => entries.get(kind)).filter((entry): entry is BuildUtilityEntry => Boolean(entry));
}
