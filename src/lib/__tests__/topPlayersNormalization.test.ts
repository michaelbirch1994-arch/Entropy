import { describe, expect, it } from "vitest";
import {
  buildNormalizedTopPlayerSources,
  mergePlayerSkillBreakdownsForAccount,
  normalizeTopPlayersLeaderboard,
} from "../topPlayersNormalization";
import type { ReportStats } from "../../types/report";

function legacySplitStats(): ReportStats {
  return {
    total: 3,
    leaderboards: {
      dps: [
        { rank: 2, account: "Player.1234", profession: "Guardian", professionList: ["Guardian"], value: 20, count: 2 },
        { rank: 1, account: "Player.1234", profession: "Necromancer", professionList: ["Necromancer"], value: 45, count: 1 },
        { rank: 3, account: "Rival.5678", profession: "Warrior", professionList: ["Warrior"], value: 25, count: 3 },
      ],
      damage: [
        { rank: 3, account: "Player.1234", profession: "Guardian", professionList: ["Guardian"], value: 1200, count: 2 },
        { rank: 2, account: "Player.1234", profession: "Necromancer", professionList: ["Necromancer"], value: 1800, count: 1 },
        { rank: 1, account: "Rival.5678", profession: "Warrior", professionList: ["Warrior"], value: 2500, count: 3 },
      ],
      downContrib: [
        { rank: 2, account: "Player.1234", profession: "Guardian", professionList: ["Guardian"], value: 40, count: 2 },
        { rank: 1, account: "Player.1234", profession: "Necromancer", professionList: ["Necromancer"], value: 60, count: 1 },
      ],
    },
    offensePlayers: [
      {
        account: "Player.1234",
        profession: "Guardian",
        professionList: ["Guardian"],
        offenseTotals: { damage: 1200, directDmg: 700, downContribution: 40, downed: 1, killed: 0 } as any,
        offenseRateWeights: {},
        totalFightMs: 60000,
      },
      {
        account: "Player.1234",
        profession: "Necromancer",
        professionList: ["Necromancer"],
        offenseTotals: { damage: 1800, directDmg: 1000, downContribution: 60, downed: 2, killed: 1 } as any,
        offenseRateWeights: {},
        totalFightMs: 40000,
      },
      {
        account: "Rival.5678",
        profession: "Warrior",
        professionList: ["Warrior"],
        offenseTotals: { damage: 2500, directDmg: 2000, downContribution: 50, downed: 1, killed: 1 } as any,
        offenseRateWeights: {},
        totalFightMs: 100000,
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
    defensePlayers: [
      {
        account: "Player.1234",
        profession: "Guardian",
        professionList: ["Guardian"],
        defenseTotals: { damageTaken: 4000, powerDamageTaken: 3000 } as any,
        totalFightMs: 60000,
      },
      {
        account: "Player.1234",
        profession: "Necromancer",
        professionList: ["Necromancer"],
        defenseTotals: { damageTaken: 5000, conditionDamageTaken: 2000 } as any,
        totalFightMs: 40000,
      },
    ],
    generalPlayers: [
      {
        account: "Player.1234",
        profession: "Guardian",
        professionList: ["Guardian"],
        totalFightMs: 60000,
        squadActiveMs: 55000,
        totalDist: 6000,
        distCount: 10,
        logsJoined: 2,
        stackedLogCount: 1,
      },
      {
        account: "Player.1234",
        profession: "Necromancer",
        professionList: ["Necromancer"],
        totalFightMs: 40000,
        squadActiveMs: 35000,
        totalDist: 4000,
        distCount: 5,
        logsJoined: 1,
        stackedLogCount: 1,
      },
      {
        account: "Rival.5678",
        profession: "Warrior",
        professionList: ["Warrior"],
        totalFightMs: 100000,
        squadActiveMs: 90000,
        totalDist: 0,
        distCount: 0,
        logsJoined: 3,
        stackedLogCount: 0,
      },
    ],
    playerSkillBreakdowns: {
      "Player.1234": {
        account: "Player.1234",
        profession: "Guardian",
        professionList: ["Guardian"],
        damage: [{ id: "1", name: "Shared Skill", value: 100, hits: 2 }],
        healing: [],
        barrier: [],
      },
      "Player.1234::Guardian": {
        account: "Player.1234",
        profession: "Guardian",
        professionList: ["Guardian"],
        damage: [{ id: "1", name: "Shared Skill", value: 100, hits: 2 }],
        healing: [{ id: "2", name: "Guard Heal", value: 300, hits: 1 }],
        barrier: [],
      },
      "Player.1234::Necromancer": {
        account: "Player.1234",
        profession: "Necromancer",
        professionList: ["Necromancer"],
        damage: [
          { id: "1", name: "Shared Skill", value: 50, hits: 1 },
          { id: "3", name: "Necro Skill", value: 500, hits: 4 },
        ],
        healing: [{ id: "4", name: "Necro Heal", value: 200, hits: 1 }],
        barrier: [],
      },
    },
  } as ReportStats;
}

describe("Top Players legacy normalization", () => {
  it("collapses legacy leaderboard profession rows and recomputes DPS from combined time", () => {
    const stats = legacySplitStats();
    const sources = buildNormalizedTopPlayerSources(stats);

    const damage = normalizeTopPlayersLeaderboard(stats, "damage", sources);
    expect(damage).toHaveLength(2);
    expect(damage[0]).toMatchObject({
      rank: 1,
      account: "Player.1234",
      profession: "Guardian",
      value: 3000,
      count: 3,
    });
    expect(damage[0].professionList).toEqual(expect.arrayContaining(["Guardian", "Necromancer"]));

    const dps = normalizeTopPlayersLeaderboard(stats, "dps", sources);
    expect(dps[0]).toMatchObject({ rank: 1, account: "Player.1234", value: 30, count: 3 });
    expect(dps[1]).toMatchObject({ rank: 2, account: "Rival.5678", value: 25, count: 3 });

    const downContrib = normalizeTopPlayersLeaderboard(stats, "downContrib", sources);
    expect(downContrib).toHaveLength(1);
    expect(downContrib[0]).toMatchObject({ account: "Player.1234", value: 100, rank: 1 });
  });

  it("merges expanded-card offense, healing, support, defense, and sample context by account", () => {
    const sources = buildNormalizedTopPlayerSources(legacySplitStats());
    const player = sources.get("Player.1234");

    expect(player?.offense?.offenseTotals).toMatchObject({ damage: 3000, directDmg: 1700, downContribution: 100, downed: 3, killed: 1 });
    expect(player?.offense?.totalFightMs).toBe(100000);
    expect(player?.healing?.healingTotals.healing).toBe(3000);
    expect(player?.healing?.healingCoverage).toBe("partial");
    expect(player?.support?.supportTotals).toMatchObject({ condiCleanse: 7, boonStrips: 10 });
    expect(player?.defense?.defenseTotals).toMatchObject({ damageTaken: 9000, powerDamageTaken: 3000, conditionDamageTaken: 2000 });
    expect(player?.general).toMatchObject({ totalFightMs: 100000, squadActiveMs: 90000, logsJoined: 3, totalDist: 10000, distCount: 15 });
  });

  it("merges profession-specific skill breakdowns without double-counting the account fallback copy", () => {
    const stats = legacySplitStats();
    const merged = mergePlayerSkillBreakdownsForAccount(
      stats.playerSkillBreakdowns,
      "Player.1234",
      "Guardian",
      ["Guardian", "Necromancer"],
    );

    expect(merged?.damage).toEqual([
      expect.objectContaining({ id: "3", name: "Necro Skill", value: 500, hits: 4 }),
      expect.objectContaining({ id: "1", name: "Shared Skill", value: 150, hits: 3 }),
    ]);
    expect(merged?.healing).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "2", value: 300 }),
      expect.objectContaining({ id: "4", value: 200 }),
    ]));
  });

  it("leaves a modern one-row leaderboard unchanged", () => {
    const stats = legacySplitStats();
    stats.offensePlayers = [stats.offensePlayers[0]];
    stats.generalPlayers = [stats.generalPlayers[0]];
    stats.leaderboards.damage = [stats.leaderboards.damage[0]];
    stats.leaderboards.dps = [stats.leaderboards.dps[0]];

    const sources = buildNormalizedTopPlayerSources(stats);
    expect(normalizeTopPlayersLeaderboard(stats, "damage", sources)[0]).toMatchObject({
      account: "Player.1234",
      profession: "Guardian",
      value: 1200,
      count: 2,
      rank: 1,
    });
    expect(normalizeTopPlayersLeaderboard(stats, "dps", sources)[0]).toMatchObject({ value: 20, rank: 1 });
  });
});
