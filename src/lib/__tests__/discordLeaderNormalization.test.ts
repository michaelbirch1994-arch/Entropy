import { describe, expect, it } from "vitest";
import { resolveDiscordReportLeaders } from "../discordLeaderNormalization";
import type { ReportStats } from "../../types/report";

function legacyStats(): ReportStats {
  return {
    total: 3,
    leaderboards: {
      damage: [
        { rank: 1, account: "Other.9999", profession: "Warrior", professionList: ["Warrior"], value: 1200, count: 3 },
        { rank: 2, account: "Player.1234", profession: "Necromancer", professionList: ["Necromancer"], value: 700, count: 1 },
        { rank: 3, account: "Player.1234", profession: "Guardian", professionList: ["Guardian"], value: 600, count: 2 },
      ],
      downContribution: [
        { rank: 1, account: "Other.9999", profession: "Warrior", professionList: ["Warrior"], value: 90, count: 3 },
        { rank: 2, account: "Player.1234", profession: "Guardian", professionList: ["Guardian"], value: 60, count: 2 },
        { rank: 3, account: "Player.1234", profession: "Necromancer", professionList: ["Necromancer"], value: 40, count: 1 },
      ],
      healing: [
        { rank: 1, account: "Other.9999", profession: "Warrior", professionList: ["Warrior"], value: 1000, count: 3 },
        { rank: 2, account: "Player.1234", profession: "Guardian", professionList: ["Guardian"], value: 700, count: 2 },
        { rank: 3, account: "Player.1234", profession: "Necromancer", professionList: ["Necromancer"], value: 500, count: 1 },
      ],
      boonStrips: [
        { rank: 1, account: "Other.9999", profession: "Warrior", professionList: ["Warrior"], value: 8, count: 3 },
        { rank: 2, account: "Player.1234", profession: "Guardian", professionList: ["Guardian"], value: 5, count: 2 },
        { rank: 3, account: "Player.1234", profession: "Necromancer", professionList: ["Necromancer"], value: 4, count: 1 },
      ],
    },
    offensePlayers: [
      {
        account: "Player.1234",
        profession: "Guardian",
        professionList: ["Guardian"],
        offenseTotals: { damage: 600, downContribution: 60 } as any,
        offenseRateWeights: {},
        totalFightMs: 60_000,
      },
      {
        account: "Player.1234",
        profession: "Necromancer",
        professionList: ["Necromancer"],
        offenseTotals: { damage: 700, downContribution: 40 } as any,
        offenseRateWeights: {},
        totalFightMs: 40_000,
      },
      {
        account: "Other.9999",
        profession: "Warrior",
        professionList: ["Warrior"],
        offenseTotals: { damage: 1200, downContribution: 90 } as any,
        offenseRateWeights: {},
        totalFightMs: 100_000,
      },
    ],
    healingPlayers: [
      { account: "Player.1234", profession: "Guardian", professionList: ["Guardian"], healingTotals: { healing: 700 } as any, activeMs: 60_000, hasHealAddon: true, healingCoverage: "full" },
      { account: "Player.1234", profession: "Necromancer", professionList: ["Necromancer"], healingTotals: { healing: 500 } as any, activeMs: 40_000, hasHealAddon: true, healingCoverage: "full" },
      { account: "Other.9999", profession: "Warrior", professionList: ["Warrior"], healingTotals: { healing: 1000 } as any, activeMs: 100_000, hasHealAddon: true, healingCoverage: "full" },
    ],
    supportPlayers: [
      { account: "Player.1234", profession: "Guardian", professionList: ["Guardian"], supportTotals: { boonStrips: 5 } as any, activeMs: 60_000, logsJoined: 2 },
      { account: "Player.1234", profession: "Necromancer", professionList: ["Necromancer"], supportTotals: { boonStrips: 4 } as any, activeMs: 40_000, logsJoined: 1 },
      { account: "Other.9999", profession: "Warrior", professionList: ["Warrior"], supportTotals: { boonStrips: 8 } as any, activeMs: 100_000, logsJoined: 3 },
    ],
    generalPlayers: [
      { account: "Player.1234", profession: "Guardian", professionList: ["Guardian"], totalFightMs: 60_000, squadActiveMs: 55_000, totalDist: 0, distCount: 0, logsJoined: 2, stackedLogCount: 0 },
      { account: "Player.1234", profession: "Necromancer", professionList: ["Necromancer"], totalFightMs: 40_000, squadActiveMs: 35_000, totalDist: 0, distCount: 0, logsJoined: 1, stackedLogCount: 0 },
      { account: "Other.9999", profession: "Warrior", professionList: ["Warrior"], totalFightMs: 100_000, squadActiveMs: 90_000, totalDist: 0, distCount: 0, logsJoined: 3, stackedLogCount: 0 },
    ],
    defensePlayers: [],
  } as any;
}

describe("resolveDiscordReportLeaders", () => {
  it("combines legacy profession slices before choosing Discord leaders", () => {
    const leaders = resolveDiscordReportLeaders(legacyStats());

    expect(leaders.damage).toMatchObject({ account: "Player.1234", profession: "Guardian", value: 1300, count: 3 });
    expect(leaders.downContrib).toMatchObject({ account: "Player.1234", profession: "Guardian", value: 100, count: 3 });
    expect(leaders.healing).toMatchObject({ account: "Player.1234", profession: "Guardian", value: 1200, count: 3 });
    expect(leaders.strips).toMatchObject({ account: "Player.1234", profession: "Guardian", value: 9, count: 3 });
  });
});
