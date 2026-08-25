import { describe, expect, it } from "vitest";
import { normalizeDefensivePlayerRows } from "../defensivePlayerNormalization";
import type { ReportStats } from "../../types/report";

function legacySplitStats(): ReportStats {
  return {
    total: 3,
    supportPlayers: [
      {
        account: "Player.1234",
        profession: "Guardian",
        professionList: ["Guardian"],
        supportTotals: { condiCleanse: 2, boonStrips: 1, resurrects: 1 } as any,
        activeMs: 60_000,
        logsJoined: 2,
      },
      {
        account: "Player.1234",
        profession: "Necromancer",
        professionList: ["Necromancer"],
        supportTotals: { condiCleanse: 5, boonStrips: 4, resurrects: 2 } as any,
        activeMs: 30_000,
        logsJoined: 2,
      },
    ],
    healingPlayers: [
      {
        account: "Player.1234",
        profession: "Guardian",
        professionList: ["Guardian"],
        healingTotals: { healing: 1000, squadHealing: 900, barrier: 400 } as any,
        activeMs: 60_000,
        hasHealAddon: true,
        healingCoverage: "full",
      },
      {
        account: "Player.1234",
        profession: "Necromancer",
        professionList: ["Necromancer"],
        healingTotals: { healing: 500, squadHealing: 350, barrier: 100 } as any,
        activeMs: 30_000,
        hasHealAddon: false,
        healingCoverage: "partial",
      },
    ],
    defensePlayers: [
      {
        account: "Player.1234",
        profession: "Guardian",
        professionList: ["Guardian"],
        defenseTotals: { damageTaken: 1000, powerDamageTaken: 700, conditionDamageTaken: 300, blockedCount: 2 } as any,
        totalFightMs: 60_000,
      },
      {
        account: "Player.1234",
        profession: "Necromancer",
        professionList: ["Necromancer"],
        defenseTotals: { damageTaken: 500, powerDamageTaken: 200, conditionDamageTaken: 300, blockedCount: 3 } as any,
        totalFightMs: 30_000,
      },
    ],
    damageMitigationPlayers: [
      {
        account: "Player.1234",
        name: "Guardian Character",
        profession: "Guardian",
        professionList: ["Guardian"],
        activeMs: 60_000,
        mitigationTotals: {
          totalHits: 10,
          blocked: 1,
          evaded: 2,
          glanced: 0,
          missed: 0,
          invulned: 0,
          interrupted: 0,
          totalMitigation: 200,
          minMitigation: 100,
          isEstimated: false,
        },
      },
      {
        account: "Player.1234",
        name: "Necromancer Character",
        profession: "Necromancer",
        professionList: ["Necromancer"],
        activeMs: 30_000,
        mitigationTotals: {
          totalHits: 8,
          blocked: 2,
          evaded: 1,
          glanced: 1,
          missed: 1,
          invulned: 0,
          interrupted: 1,
          totalMitigation: 300,
          minMitigation: 150,
          isEstimated: true,
        },
      },
    ],
  } as ReportStats;
}

describe("normalizeDefensivePlayerRows", () => {
  it("combines legacy profession slices without dropping defensive contributions", () => {
    const normalized = normalizeDefensivePlayerRows(legacySplitStats());

    expect(normalized.supportPlayers).toHaveLength(1);
    expect(normalized.supportPlayers[0]).toMatchObject({
      account: "Player.1234",
      profession: "Guardian",
      activeMs: 90_000,
      logsJoined: 3,
    });
    expect(normalized.supportPlayers[0].professionList).toEqual(expect.arrayContaining(["Guardian", "Necromancer"]));
    expect(normalized.supportPlayers[0].supportTotals).toMatchObject({ condiCleanse: 7, boonStrips: 5, resurrects: 3 });

    expect(normalized.healingPlayers).toHaveLength(1);
    expect(normalized.healingPlayers[0]).toMatchObject({
      profession: "Guardian",
      activeMs: 90_000,
      hasHealAddon: false,
      healingCoverage: "partial",
    });
    expect(normalized.healingPlayers[0].healingTotals).toMatchObject({ healing: 1500, squadHealing: 1250, barrier: 500 });

    expect(normalized.defensePlayers).toHaveLength(1);
    expect(normalized.defensePlayers[0]).toMatchObject({ profession: "Guardian", totalFightMs: 90_000 });
    expect(normalized.defensePlayers[0].defenseTotals).toMatchObject({
      damageTaken: 1500,
      powerDamageTaken: 900,
      conditionDamageTaken: 600,
      blockedCount: 5,
    });

    expect(normalized.damageMitigationPlayers).toHaveLength(1);
    expect(normalized.damageMitigationPlayers[0]).toMatchObject({ profession: "Guardian", activeMs: 90_000 });
    expect(normalized.damageMitigationPlayers[0].mitigationTotals).toMatchObject({
      totalHits: 18,
      blocked: 3,
      evaded: 3,
      totalMitigation: 500,
      minMitigation: 250,
      isEstimated: true,
    });
  });

  it("keeps modern one-row-per-account values unchanged", () => {
    const stats = legacySplitStats();
    stats.supportPlayers = [stats.supportPlayers[0]];
    stats.healingPlayers = [stats.healingPlayers[0]];
    stats.defensePlayers = [stats.defensePlayers[0]];
    stats.damageMitigationPlayers = [stats.damageMitigationPlayers![0]];

    const normalized = normalizeDefensivePlayerRows(stats);

    expect(normalized.supportPlayers[0]).toEqual(stats.supportPlayers[0]);
    expect(normalized.healingPlayers[0]).toEqual(stats.healingPlayers[0]);
    expect(normalized.defensePlayers[0]).toEqual(stats.defensePlayers[0]);
    expect(normalized.damageMitigationPlayers[0]).toEqual(stats.damageMitigationPlayers[0]);
  });

  it("does not mark combined mitigation estimated when an estimated slice contributes no mitigation", () => {
    const stats = legacySplitStats();
    stats.damageMitigationPlayers![1].mitigationTotals.totalMitigation = 0;
    stats.damageMitigationPlayers![1].mitigationTotals.minMitigation = 0;

    const [row] = normalizeDefensivePlayerRows(stats).damageMitigationPlayers;
    expect(row.mitigationTotals.isEstimated).toBe(false);
  });
});
