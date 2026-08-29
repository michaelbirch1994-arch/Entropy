import type { Gw2ApiFact, Gw2Skill, Gw2Trait } from "../../types/buildEditor";

/**
 * Squad boon-coverage engine. Scans a build's selected skills and active
 * traits for GW2 API `facts` entries that grant one of the 12 real boons,
 * then uses a short text heuristic over each entity's `description` to
 * infer whether the boon reaches nearby allies or just the caster - the
 * GW2 API doesn't expose that distinction as structured data, so this
 * infers it from the wording instead.
 */

const BUFF_FACT_TYPES = new Set(["Buff", "ApplyBuffCondition", "PrefixedBuff"]);

export const BOON_NAMES = new Set([
  "Aegis",
  "Alacrity",
  "Fury",
  "Might",
  "Protection",
  "Quickness",
  "Regeneration",
  "Resistance",
  "Resolution",
  "Stability",
  "Swiftness",
  "Vigor",
]);

export const BOON_DISPLAY_ORDER = [
  "Aegis",
  "Alacrity",
  "Fury",
  "Might",
  "Protection",
  "Quickness",
  "Regeneration",
  "Resistance",
  "Resolution",
  "Stability",
  "Swiftness",
  "Vigor",
];

export interface BoonSource {
  type: "skill" | "trait";
  sourceName: string;
  stacks: number;
  duration: number;
  isAlly: boolean;
  icon?: string;
  recharge?: number;
  estimatedUptimePercent?: number;
}

export interface BoonCoverageEntry {
  name: string;
  sources: BoonSource[];
  hasAllySource: boolean;
  icon?: string;
  estimatedUptimePercent?: number;
}

function isAllyTargeted(description: string | undefined, statusName: string, allBoonNames: string[]): boolean {
  if (!description) return false;
  const desc = description.toLowerCase();
  const statusLower = statusName.toLowerCase();
  const sentences = desc.split(".");

  let foundInAllySentence = false;
  let foundInDescription = false;
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const hasAlly = /\balli(?:es|ed)?\b/.test(trimmed) || /\bally\b/.test(trimmed);
    const hasBoon = trimmed.includes(statusLower);
    if (hasBoon) foundInDescription = true;
    if (hasBoon && hasAlly) foundInAllySentence = true;
  }

  if (foundInAllySentence) return true;
  if (foundInDescription) return false;

  const hasGenericAlly = /\balli(?:es|ed)?\b/.test(desc) || /\bally\b/.test(desc);
  if (!hasGenericAlly) return false;

  for (const otherBoon of allBoonNames) {
    const otherLower = otherBoon.toLowerCase();
    if (otherLower === statusLower) continue;
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      const hasAlly = /\balli(?:es|ed)?\b/.test(trimmed) || /\bally\b/.test(trimmed);
      if (trimmed.includes(otherLower) && hasAlly) return false;
    }
  }

  return true;
}

interface BoonScanEntity {
  name: string;
  description?: string;
  facts?: Gw2ApiFact[];
}

function findRechargeSeconds(facts: Gw2ApiFact[]): number | undefined {
  const rechargeFact = facts.find((fact) => fact.type === "Recharge");
  return rechargeFact?.value;
}

function scanEntity(
  entity: BoonScanEntity,
  type: "skill" | "trait",
  boonMap: Map<string, BoonCoverageEntry>,
  boonDurationPercent: number,
) {
  const facts = entity.facts ?? [];
  const description = entity.description ?? "";

  const entityBoonNames: string[] = [];
  for (const fact of facts) {
    if (!fact.type || !BUFF_FACT_TYPES.has(fact.type) || !fact.status) continue;
    if (BOON_NAMES.has(fact.status)) entityBoonNames.push(fact.status);
  }

  for (const fact of facts) {
    if (!fact.type || !BUFF_FACT_TYPES.has(fact.type) || !fact.status) continue;
    const name = fact.status;
    if (!BOON_NAMES.has(name)) continue;

    const stacks = fact.apply_count || 1;
    const duration = fact.duration || 0;
    const isAlly = isAllyTargeted(description, name, entityBoonNames);

    const recharge = type === "skill" ? findRechargeSeconds(facts) : undefined;
    const effectiveDuration = duration * (1 + boonDurationPercent / 100);
    const estimatedUptimePercent =
      recharge && recharge > 0 ? Math.min(100, (effectiveDuration / recharge) * 100) : undefined;

    const source: BoonSource = {
      type,
      sourceName: entity.name || "",
      stacks,
      duration,
      isAlly,
      icon: fact.icon,
      recharge,
      estimatedUptimePercent,
    };

    if (!boonMap.has(name)) boonMap.set(name, { name, sources: [], hasAllySource: false });
    const entry = boonMap.get(name)!;
    const isDuplicate = entry.sources.some(
      (existing) =>
        existing.sourceName === source.sourceName &&
        existing.stacks === source.stacks &&
        existing.duration === source.duration,
    );
    if (!isDuplicate) entry.sources.push(source);
  }
}

/** Compute boon coverage for one build from its resolved active skills + traits. */
export function analyzeBuildBoons(
  skills: Gw2Skill[],
  traits: Gw2Trait[],
  boonDurationPercent = 0,
): BoonCoverageEntry[] {
  const boonMap = new Map<string, BoonCoverageEntry>();
  for (const skill of skills) if (skill) scanEntity(skill, "skill", boonMap, boonDurationPercent);
  for (const trait of traits) if (trait) scanEntity(trait, "trait", boonMap, boonDurationPercent);

  const order = new Map(BOON_DISPLAY_ORDER.map((name, index) => [name, index]));
  return [...boonMap.values()]
    .map((entry) => {
      const knownUptimes = entry.sources
        .map((source) => source.estimatedUptimePercent)
        .filter((value): value is number => value != null);
      const estimatedUptimePercent = knownUptimes.length
        ? Math.min(100, knownUptimes.reduce((sum, value) => sum + value, 0))
        : undefined;
      return {
        ...entry,
        hasAllySource: entry.sources.some((source) => source.isAlly),
        icon: entry.sources.find((source) => source.icon)?.icon,
        estimatedUptimePercent,
      };
    })
    .sort((a, b) => (order.get(a.name) ?? 999) - (order.get(b.name) ?? 999));
}
