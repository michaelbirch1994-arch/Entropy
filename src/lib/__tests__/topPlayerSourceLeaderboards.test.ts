import { describe, expect, it } from "vitest";
import { buildNormalizedTopPlayerSourceLeaderboards } from "../topPlayerSourceLeaderboards";
import { buildNormalizedTopPlayerSources } from "../topPlayersNormalization";
import type { ReportStats } from "../../types/report";

function legacyStats(): ReportStats {
  return {
    total: 3,
    leaderboards: {
      stability: [
        { rank: 2, account: "Player.1234", profession: "Guardian", professionList: ["Guardian"], value: 40, count: 2 },
        { rank: 1, account: "Player.1234", profession: "Necromancer", professionList: ["Necromancer"], value: 60, count: 1 },
      ],
      dodges: [
        { rank: 2, account: "Player.1234", profession: "Guardian", professionList: ["Guardian"], value: 5, count: 2 },
        { rank: 1, account: "Player.1234", profession: "Necromancer", professionList: ["Necromancer"], value: 7, count: 1 },
      ],
      damage: [
        { rank: 1, account: "Other.9999", profession: "Warrior", professionList: ["Warrior"], value: 5000, count: 3 },
      ],
    },
    generalPlayers: [
      {
        account: "Player.1234",
        profession: "Guardian",
        professionList: ["Guardian"],
        totalFightMs: 60_000,
        squadActiveMs: 55_000,
        totalDist: 0,
        distCount: 0,
        logsJoined: 2,
        stackedLogCount: 0,
      },
      {
        account: "Player.1234",
        profession: "Necromancer",
        professionList: ["Necromancer"],
        totalFightMs: 40_000,
        squadActiveMs: 35_000,
        totalDist: 0,
        distCount: 0,
        logsJoined: 1,
        stackedLogCount: 0,
      },
    ],
    offensePlayers: [],
    healingPlayers: [],
    supportPlayers: [],
    defensePlayers: [],
  } as unknown as ReportStats;
}

describe("buildNormalizedTopPlayerSourceLeaderboards", () => {
  it("combines legacy Stability and Dodges slices for expanded cards", () => {
    const stats = legacyStats();
    const sourceMap = buildNormalizedTopPlayerSources(stats);
    const leaderboards = buildNormalizedTopPlayerSourceLeaderboards(stats, sourceMap);

    expect(leaderboards.stability).toHaveLength(1);
    expect(leaderboards.stability[0]).toMatchObject({
      account: "Player.1234",
      profession: "Guardian",
      value: 100,
      count: 3,
      rank: 1,
    });
    expect(leaderboards.dodges).toHaveLength(1);
    expect(leaderboards.dodges[0]).toMatchObject({
      account: "Player.1234",
      profession: "Guardian",
      value: 12,
      count: 3,
      rank: 1,
    });
    expect(leaderboards.damage).toEqual(stats.leaderboards.damage);
  });

  it("leaves modern one-row Stability and Dodges values unchanged", () => {
    const stats = legacyStats();
    stats.leaderboards.stability = [stats.leaderboards.stability[0]];
    stats.leaderboards.dodges = [stats.leaderboards.dodges[0]];
    stats.generalPlayers = [stats.generalPlayers[0]];

    const leaderboards = buildNormalizedTopPlayerSourceLeaderboards(stats);
    expect(leaderboards.stability[0]).toMatchObject({ value: 40, count: 2, profession: "Guardian" });
    expect(leaderboards.dodges[0]).toMatchObject({ value: 5, count: 2, profession: "Guardian" });
  });
});
