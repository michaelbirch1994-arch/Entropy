import { describe, expect, it } from "vitest";
import { buildSquadOverviewRows } from "../squadOverviewAggregation";
import type { ReportStats } from "../../types/report";

function legacySplitStats(): ReportStats {
  return {
    total: 3,
    offensePlayers: [
      {
        account: "Player.1234",
        profession: "Guardian",
        professionList: ["Guardian"],
        offenseTotals: { damage: 1200, damageAll: 1400, downContribution: 40 } as any,
        offenseRateWeights: {},
        totalFightMs: 60000,
      },
      {
        account: "Player.1234",
        profession: "Necromancer",
        professionList: ["Necromancer"],
        offenseTotals: { damage: 1800, damageAll: 2000, downContribution: 60 } as any,
        offenseRateWeights: {},
        totalFightMs: 40000,
      },
    ],
    healingPlayers: [
      {
        account: "Player.1234",
        profession: "Guardian",
        professionList: ["Guardian"],
        healingTotals: { healing: 1000, squadHealing: 900 } as any,
        activeMs: 60000,
        hasHealAddon: true,
        healingCoverage: "full",
      },
      {
        account: "Player.1234",
        profession: "Necromancer",
        professionList: ["Necromancer"],
        healingTotals: { healing: 2000, squadHealing: 1500 } as any,
        activeMs: 40000,
        hasHealAddon: false,
        healingCoverage: "partial",
      },
    ],
    supportPlayers: [
      {
        account: "Player.1234",
        profession: "Guardian",
        professionList: ["Guardian"],
        supportTotals: { condiCleanse: 2, boonStrips: 3 } as any,
        activeMs: 60000,
        logsJoined: 2,
      },
      {
        account: "Player.1234",
        profession: "Necromancer",
        professionList: ["Necromancer"],
        supportTotals: { condiCleanse: 5, boonStrips: 7 } as any,
        activeMs: 40000,
        logsJoined: 1,
      },
    ],
    generalPlayers: [
      {
        account: "Player.1234",
        profession: "Guardian",
        professionList: ["Guardian"],
        totalFightMs: 60000,
        squadActiveMs: 55000,
        totalDist: 0,
        distCount: 0,
        logsJoined: 2,
        stackedLogCount: 0,
      },
      {
        account: "Player.1234",
        profession: "Necromancer",
        professionList: ["Necromancer"],
        totalFightMs: 40000,
        squadActiveMs: 35000,
        totalDist: 0,
        distCount: 0,
        logsJoined: 1,
        stackedLogCount: 0,
      },
    ],
    attendanceData: [
      {
        account: "Player.1234",
        characterNames: ["Guard", "Necro"],
        combatTimeMs: 95000,
        squadTimeMs: 120000,
        classTimes: [
          { profession: "Guardian", timeMs: 60000 },
          { profession: "Necromancer", timeMs: 40000 },
        ],
      },
    ],
  } as ReportStats;
}

describe("buildSquadOverviewRows", () => {
  it("collapses legacy profession-split rows into one account without repeating support totals", () => {
    const rows = buildSquadOverviewRows(legacySplitStats(), "players", "all");

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      account: "Player.1234",
      profession: "Guardian",
      damage: 3000,
      downContribution: 100,
      healing: 3000,
      cleanses: 7,
      strips: 10,
      combatMs: 95000,
      logs: 3,
      participation: 1,
    });
    expect(rows[0].dps).toBe(30);
    expect(rows[0].professionList).toEqual(expect.arrayContaining(["Guardian", "Necromancer"]));
    expect(rows[0].heal?.healingCoverage).toBe("partial");
  });

  it("leaves a modern one-row-per-account report numerically unchanged", () => {
    const stats = legacySplitStats();
    stats.offensePlayers = [stats.offensePlayers[0]];
    stats.healingPlayers = [stats.healingPlayers[0]];
    stats.supportPlayers = [stats.supportPlayers[0]];
    stats.generalPlayers = [stats.generalPlayers[0]];
    stats.attendanceData[0].combatTimeMs = 55000;

    const [row] = buildSquadOverviewRows(stats, "players", "squad");
    expect(row.damage).toBe(1200);
    expect(row.dps).toBe(20);
    expect(row.healing).toBe(900);
    expect(row.cleanses).toBe(2);
    expect(row.strips).toBe(3);
    expect(row.combatMs).toBe(55000);
    expect(row.logs).toBe(2);
    expect(row.heal?.healingCoverage).toBe("full");
  });
});
