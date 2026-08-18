/**
 * Damage taxonomy — normalized damage classification with explicit provenance.
 *
 * The governing rule of this module: a category is only populated when the source
 * data actually supports it. Where Guild Wars 2 / arcdps / Elite Insights do not
 * distinguish something, the category reports `unavailable` with a reason rather
 * than being reconstructed from a plausible-looking proxy.
 *
 * ---------------------------------------------------------------------------
 * WHY LIFE-STEAL DAMAGE IS NOT CLASSIFIED HERE
 * ---------------------------------------------------------------------------
 * Two candidate signals were tested against a real 14-player WvW log and both
 * were rejected:
 *
 * 1. "Skill appears in both the damage and healing distributions."
 *    19 candidates, mostly false positives — Journey, Crescendo, Seed of Life and
 *    friends damage foes and heal allies in the same cast without being life steal.
 *
 * 2. "Skill has skillMap[id].conversionBasedHealing === true."
 *    116 of 168 damaging skills in that log carry this flag, including Firestorm,
 *    Whirling Axe, Lightning Orb and Frost Burst. The flag means "*if* this skill
 *    produces healing, that healing is conversion-based" — it describes a healing
 *    pathway, not a damage type. Classifying damage with it is worse than (1).
 *
 * The underlying fact: arcdps logs life-steal damage as ordinary strike damage
 * (`CBTS_COMBAT`) with the siphoning skill's id and no distinguishing flag. EI
 * adds none either. The information does not exist in the log.
 *
 * `conversionBasedHealing` / `hybridHealing` ARE authoritative for the *healing*
 * side — verified three-for-three against skills whose aggregate buckets matched
 * to the exact integer (79344 Lesser Signet of the Locust → conversion, 71813
 * Hungering Maelstrom → hybrid, 21762 Signet of Vampirism → neither). That is why
 * healing classification is derived and damage classification is not.
 *
 * See ENTROPY_HEALING_INVESTIGATION.md.
 */

/** Categories Entropy can populate from real log data. */
export type DamageCategory =
      | 'strike'
    | 'condition'
    | 'breakbar'
    | 'barrierAbsorbed'
    | 'downContribution';

/** Categories requested but not derivable — kept named so the UI can say *why*. */
export type UnavailableDamageCategory =
      | 'lifeSteal'
    | 'reflect'
    | 'retaliation'
    | 'environmental'
    | 'downedStateDamage';

export type DamageProvenance =
      /** Elite Insights' own per-entry classification (`indirectDamage`). */
    | 'ei-classified'
    /** A flag arcdps itself sets on the combat event, per the published EVTC spec. */
    | 'arcdps-flag'
    /** Present in the log but not separable into this category. */
    | 'unavailable';

export interface DamageBucket {
      category: DamageCategory;
      label: string;
      value: number;
      provenance: DamageProvenance;
}

export interface UnavailableBucket {
      category: UnavailableDamageCategory;
      label: string;
      /** Plain-language reason, safe to surface directly in a tooltip. */
    reason: string;
}

export interface DamageTaxonomy {
      /** Total damage as EI reports it — the sum `strike + condition` reconciles to this. */
    total: number;
      buckets: DamageBucket[];
      /** Sub-measures that overlap the buckets above rather than partitioning them. */
    overlays: DamageBucket[];
      unavailable: UnavailableBucket[];
}

/** One entry of EI's `totalDamageDist[phase]`. */
export interface DamageDistEntry {
      id: number;
      totalDamage?: number;
      totalBreakbarDamage?: number;
      shieldDamage?: number;
      downContribution?: number;
      crit?: number;
      hits?: number;
      connectedHits?: number;
      indirectDamage?: boolean;
}

/**
 * Why each unavailable category is unavailable. These strings are user-facing —
 * Entropy should explain the gap rather than silently omitting the row.
 */
export const DAMAGE_UNAVAILABLE_REASONS: Record<UnavailableDamageCategory, string> = {
      lifeSteal:
                'Guild Wars 2 logs life-steal damage as ordinary strike damage with no distinguishing flag, ' +
                'so it cannot be separated from other direct damage. Life-siphon *healing* is tracked separately ' +
                'and is available when the source player ran the healing addon.',
      reflect:
                'arcdps attributes reflected projectile damage to the player who reflected it, with no marker ' +
                'identifying it as reflected. It is indistinguishable from that player\'s own direct damage.',
      retaliation:
                'Retaliation was removed from Guild Wars 2 in 2022 and replaced by Resolution, which is a damage ' +
                'reduction boon and deals no damage. There is nothing to measure.',
      environmental:
                'Environmental damage (falling, drowning, map hazards) is not consistently distinguished from ' +
                'skill damage in the combat log and has no stable skill-id set across maps.',
      downedStateDamage:
                'arcdps flags whether the *target* was downed when hit (is_offcycle on CBTS_COMBAT), but Elite ' +
                'Insights does not expose that flag per skill in its JSON. Damage contributing to a down is ' +
                'available instead, as "Down Contribution".',
};

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Classify one player's damage distribution.
 *
 * `strike` and `condition` partition `total`. `breakbar`, `barrierAbsorbed` and
 * `downContribution` are overlays — they measure a property of damage already
 * counted in the partition, so summing everything would double-count.
 */
export function classifyDamage(entries: DamageDistEntry[] | undefined): DamageTaxonomy {
      const list = Array.isArray(entries) ? entries : [];

    let strike = 0;
      let condition = 0;
      let breakbar = 0;
      let barrierAbsorbed = 0;
      let downContribution = 0;

    for (const e of list) {
              const dmg = num(e?.totalDamage);
              // EI's own split: indirectDamage true = buff/condition tick, false = strike.
          if (e?.indirectDamage === true) condition += dmg;
              else strike += dmg;

          breakbar += num(e?.totalBreakbarDamage);
              // arcdps CBTS_COMBAT: `overstack_value: shield damage`, flagged by is_shields.
          // Confirmed by the published EVTC spec for the DAMAGE side. (The analogous
          // healing-side reading of overstack_value remains UNVERIFIED — see
          // dataIntegrity.ts. Do not conflate the two.)
          barrierAbsorbed += num(e?.shieldDamage);
              downContribution += num(e?.downContribution);
    }

    return {
              total: strike + condition,
              buckets: [
                { category: 'strike', label: 'Direct (Strike)', value: strike, provenance: 'ei-classified' },
                { category: 'condition', label: 'Condition', value: condition, provenance: 'ei-classified' },
                        ],
              overlays: [
                { category: 'breakbar', label: 'Breakbar', value: breakbar, provenance: 'ei-classified' },
                { category: 'barrierAbsorbed', label: 'Absorbed by Barrier', value: barrierAbsorbed, provenance: 'arcdps-flag' },
                { category: 'downContribution', label: 'Down Contribution', value: downContribution, provenance: 'ei-classified' },
                        ],
              unavailable: (Object.keys(DAMAGE_UNAVAILABLE_REASONS) as UnavailableDamageCategory[]).map((category) => ({
                            category,
                            label: DAMAGE_CATEGORY_LABELS[category],
                            reason: DAMAGE_UNAVAILABLE_REASONS[category],
              })),
    };
}

export const DAMAGE_CATEGORY_LABELS: Record<UnavailableDamageCategory, string> = {
      lifeSteal: 'Life Siphon / Life Steal',
      reflect: 'Reflected',
      retaliation: 'Retaliation',
      environmental: 'Environmental',
      downedStateDamage: 'Damage to Downed',
};

/**
 * Scaling classification for a *healing* skill, read from EI's skillMap/buffMap.
 *
 * This is the authoritative per-skill table the healing buckets are built from —
 * unlike the damage side, it is directly usable. Kept here so both sides of the
 * taxonomy live together and the asymmetry is visible rather than surprising.
 */
export type HealingScaling = 'healingPower' | 'conversion' | 'hybrid' | 'unknown';

export function classifyHealingSkill(
      skillId: number,
      skillMap: Record<string, any> | undefined,
      buffMap: Record<string, any> | undefined,
  ): HealingScaling {
      // A skill's metadata can land in either map depending on whether the heal was
    // a direct cast or a buff/trait proc, so both must be consulted.
    const entry = skillMap?.[`s${skillId}`] ?? buffMap?.[`b${skillId}`];
      if (!entry) return 'unknown';
      if (entry.hybridHealing === true) return 'hybrid';
      if (entry.conversionBasedHealing === true) return 'conversion';
      return 'healingPower';
}

/**
 * True when a skill's healing is life-steal-like (derived from damage dealt rather
 * than the Healing Power stat).
 *
 * NOTE: only meaningful for skills that actually produced healing. Do NOT use this
 * to classify damage — see the module header for why that fails.
 */
export function isLifeStealHealingSkill(
      skillId: number,
      skillMap: Record<string, any> | undefined,
      buffMap: Record<string, any> | undefined,
  ): boolean {
      return classifyHealingSkill(skillId, skillMap, buffMap) === 'conversion';
}
