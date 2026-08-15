import type { FightRow, TopBarrierSource, TopHealingSource, TopSkill } from "../types/report";

export interface HealingFightDrilldownRow {
  id: string;
  name: string;
  index: number;
  fullLabel: string;
  healing: number | null;
  outgoingBarrier: number | null;
  absorbedBarrier: number | null;
  incomingDamage: number;
  effectiveHealing: number | null;
  outgoingSkills: TopHealingSource[];
  barrierSkills: TopBarrierSource[];
  incomingSkills: TopSkill[];
  hasExactOutgoingSkills: boolean;
  hasExactBarrierSkills: boolean;
  hasExactIncomingSkills: boolean;
}

function optionalMetric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Keeps generated barrier and absorbed barrier as separate measurements.
 * They come from different EI data paths and are not interchangeable.
 */
export function buildHealingFightDrilldowns(fights: FightRow[]): HealingFightDrilldownRow[] {
  return fights.slice(0, 40).map((fight, index) => {
    const healing = optionalMetric(fight.totalOutgoingHealing);
    const outgoingBarrier = optionalMetric(fight.totalOutgoingBarrier);
    const absorbedBarrier = optionalMetric(fight.incomingBarrierAbsorbed);
    const incomingDamage = Number.isFinite(fight.totalIncomingDamage) ? fight.totalIncomingDamage : 0;
    const hasCompleteEffectiveHealing = healing !== null && outgoingBarrier !== null;

    return {
      id: fight.id,
      name: fight.label || `F${index + 1}`,
      index,
      fullLabel: fight.fullLabel || fight.mapName || `Fight ${index + 1}`,
      healing,
      outgoingBarrier,
      absorbedBarrier,
      incomingDamage,
      effectiveHealing: hasCompleteEffectiveHealing
        ? healing + outgoingBarrier - incomingDamage
        : null,
      outgoingSkills: fight.topOutgoingHealingSkills ?? [],
      barrierSkills: fight.topOutgoingBarrierSkills ?? [],
      incomingSkills: fight.topIncomingDamageSkills ?? [],
      hasExactOutgoingSkills: Array.isArray(fight.topOutgoingHealingSkills),
      hasExactBarrierSkills: Array.isArray(fight.topOutgoingBarrierSkills),
      hasExactIncomingSkills: Array.isArray(fight.topIncomingDamageSkills),
    };
  });
}
