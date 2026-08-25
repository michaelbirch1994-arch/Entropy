import { describe, expect, it } from "vitest";
import { normalizeOffensePlayers } from "../offensivePlayerNormalization";
import type { OffensePlayer } from "../../types/report";

function legacyRows(): OffensePlayer[] {
  return [
    {
      account: "Player.1234",
      profession: "Guardian",
      professionList: ["Guardian"],
      offenseTotals: {
        damage: 1200,
        damageAll: 1500,
        directDmg: 800,
        connectedDamageCount: 60,
        connectedDirectDamageCount: 50,
        criticalRate: 20,
        criticalDmg: 500,
        flankingRate: 10,
        glanceRate: 2,
        missed: 1,
        evaded: 2,
        blocked: 3,
        interrupts: 1,
        invulned: 4,
        killed: 1,
        downed: 2,
        againstDownedDamage: 200,
        appliedCrowdControl: 100,
        appliedCrowdControlDuration: 1200,
        appliedCrowdControlDownContribution: 20,
        appliedCrowdControlDurationDownContribution: 200,
        downContribution: 40,
        boonStrips: 3,
        battleStandardHits: 0,
      },
      offenseRateWeights: { criticalRate: 40, flankingRate: 50, glanceRate: 50 },
      totalFightMs: 60_000,
    },
    {
      account: "Player.1234",
      profession: "Necromancer",
      professionList: ["Necromancer"],
      offenseTotals: {
        damage: 1800,
        damageAll: 2100,
        directDmg: 1000,
        connectedDamageCount: 50,
        connectedDirectDamageCount: 40,
        criticalRate: 10,
        criticalDmg: 600,
        flankingRate: 20,
        glanceRate: 3,
        missed: 2,
        evaded: 1,
        blocked: 1,
        interrupts: 2,
        invulned: 3,
        killed: 2,
        downed: 3,
        againstDownedDamage: 300,
        appliedCrowdControl: 150,
        appliedCrowdControlDuration: 900,
        appliedCrowdControlDownContribution: 30,
        appliedCrowdControlDurationDownContribution: 150,
        downContribution: 60,
        boonStrips: 7,
        battleStandardHits: 0,
      },
      offenseRateWeights: { criticalRate: 20, flankingRate: 40, glanceRate: 40 },
      totalFightMs: 40_000,
    },
  ];
}

describe("normalizeOffensePlayers", () => {
  it("combines legacy profession slices and their rate denominators", () => {
    const rows = normalizeOffensePlayers(legacyRows());

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      account: "Player.1234",
      profession: "Guardian",
      totalFightMs: 100_000,
    });
    expect(rows[0].professionList).toEqual(expect.arrayContaining(["Guardian", "Necromancer"]));
    expect(rows[0].offenseTotals).toMatchObject({
      damage: 3000,
      damageAll: 3600,
      directDmg: 1800,
      criticalRate: 30,
      flankingRate: 30,
      glanceRate: 5,
      interrupts: 3,
      killed: 3,
      downed: 5,
      downContribution: 100,
      boonStrips: 10,
      appliedCrowdControl: 250,
    });
    expect(rows[0].offenseRateWeights).toEqual({ criticalRate: 60, flankingRate: 90, glanceRate: 90 });

    expect((rows[0].offenseTotals.criticalRate / rows[0].offenseRateWeights.criticalRate) * 100).toBe(50);
    expect((rows[0].offenseTotals.flankingRate / rows[0].offenseRateWeights.flankingRate) * 100).toBeCloseTo(33.333, 3);
    expect((rows[0].offenseTotals.glanceRate / rows[0].offenseRateWeights.glanceRate) * 100).toBeCloseTo(5.556, 3);
  });

  it("keeps a modern one-row-per-account player numerically unchanged", () => {
    const row = legacyRows()[0];
    expect(normalizeOffensePlayers([row])).toEqual([row]);
  });
});
