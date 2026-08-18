import { describe, expect, it } from "vitest";
import { buildHealingFightDrilldowns } from "../squadStatsDrilldowns";
import type { FightRow } from "../../types/report";

function fight(overrides: Partial<FightRow>): FightRow {
  return {
    id: "fight-1",
    label: "F1",
    fullLabel: "Alpine Borderlands (1:30)",
    timestamp: 0,
    mapName: "Alpine Borderlands",
    duration: "1:30",
    isWin: true,
    squadCount: 20,
    allyCount: 20,
    enemyCount: 20,
    teamBreakdown: [],
    alliesDown: 0,
    alliesDead: 0,
    alliesRevived: 0,
    rallies: 0,
    enemyDeaths: 5,
    enemyDowns: 8,
    totalOutgoingDamage: 1_000_000,
    totalIncomingDamage: 400_000,
    totalOutgoingStrips: 0,
    totalIncomingStrips: 0,
    totalBoonsApplied: 0,
    incomingBarrierAbsorbed: 90_000,
    outgoingBarrierAbsorbed: 0,
    squadClassCountsFight: {},
    ...overrides,
  };
}

describe("buildHealingFightDrilldowns", () => {
  it("never substitutes absorbed barrier for outgoing barrier", () => {
    const [row] = buildHealingFightDrilldowns([fight({ totalOutgoingHealing: 500_000 })]);

    expect(row.outgoingBarrier).toBeNull();
    expect(row.absorbedBarrier).toBe(90_000);
    expect(row.effectiveHealing).toBeNull();
  });

  it("calculates effective healing only from outgoing healing and generated barrier", () => {
    const [row] = buildHealingFightDrilldowns([fight({
      totalOutgoingHealing: 500_000,
      totalOutgoingBarrier: 125_000,
      incomingBarrierAbsorbed: 90_000,
      effectiveHealing: 999_999,
    })]);

    expect(row.outgoingBarrier).toBe(125_000);
    expect(row.absorbedBarrier).toBe(90_000);
    expect(row.effectiveHealing).toBe(225_000);
  });

  it("distinguishes unavailable source attribution from an observed empty distribution", () => {
    const [unavailable, observedEmpty] = buildHealingFightDrilldowns([
      fight({ id: "old", topOutgoingBarrierSkills: undefined }),
      fight({ id: "new", topOutgoingBarrierSkills: [] }),
    ]);

    expect(unavailable.hasExactBarrierSkills).toBe(false);
    expect(observedEmpty.hasExactBarrierSkills).toBe(true);
  });
});
