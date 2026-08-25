import { describe, expect, it } from "vitest";
import { aggregateReportPlayersForProfiles } from "../profileReportAggregation";
import type { ReportStats } from "../../types/report";

function legacySplitStats(): ReportStats {
  return {
    total: 3,
    offensePlayers: [
      {
        account: "Player.1234",
        profession: "Guardian",
        professionList: ["Guardian"],
        offenseTotals: { damage: 1200, downContribution: 40 } as any,
        offenseRateWeights: {},
        totalFightMs: 60000,
      },
      {
        account: "Player.1234",
        profession: "Necromancer",
        professionList: ["Necromancer"],
        offenseTotals: { damage: 1800, downContribution: 60 } as any,
        offenseRateWeights: {},
        totalFightMs: 40000,
      },
    ],
    healingPlayers: [
      {
        account: "Player.1234",
        profession: "Guardian",
        professionList: ["Guardian"],
        healingTotals: { healing: 1000, barrier: 200 } as any,
        activeMs: 60000,
        hasHealAddon: true,
      },
      {
        account: "Player.1234",
        profession: "Necromancer",
        professionList: ["Necromancer"],
        healingTotals: { healing: 2000, barrier: 300 } as any,
        activeMs: 40000,
        hasHealAddon: false,
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
  } as unknown as ReportStats;
}

describe("aggregateReportPlayersForProfiles", () => {
  it("combines legacy profession slices before career-profile recording", () => {
    const rows = aggregateReportPlayersForProfiles(legacySplitStats());
    expect(rows.size).toBe(1);
    expect(rows.get("Player.1234")).toEqual({
      profession: "Guardian",
      damage: 3000,
      dps: 30,
      downContrib: 100,
      healing: 3000,
      barrier: 500,
      cleanses: 7,
      strips: 10,
      logsJoined: 3,
    });
  });

  it("clamps summed legacy fight participation to the report total", () => {
    const stats = legacySplitStats();
    stats.generalPlayers[0].logsJoined = 3;
    stats.generalPlayers[1].logsJoined = 2;
    expect(aggregateReportPlayersForProfiles(stats).get("Player.1234")?.logsJoined).toBe(3);
  });

  it("leaves modern one-row profile ingestion numerically unchanged", () => {
    const stats = legacySplitStats();
    stats.offensePlayers = [stats.offensePlayers[0]];
    stats.healingPlayers = [stats.healingPlayers[0]];
    stats.supportPlayers = [stats.supportPlayers[0]];
    stats.generalPlayers = [stats.generalPlayers[0]];

    expect(aggregateReportPlayersForProfiles(stats).get("Player.1234")).toEqual({
      profession: "Guardian",
      damage: 1200,
      dps: 20,
      downContrib: 40,
      healing: 1000,
      barrier: 200,
      cleanses: 2,
      strips: 3,
      logsJoined: 2,
    });
  });

  it("uses general-player time to choose a primary profession when offense data is absent", () => {
    const stats = legacySplitStats();
    stats.offensePlayers = [];
    stats.generalPlayers[0].totalFightMs = 30000;
    stats.generalPlayers[1].totalFightMs = 70000;

    expect(aggregateReportPlayersForProfiles(stats).get("Player.1234")?.profession).toBe("Necromancer");
  });
});
