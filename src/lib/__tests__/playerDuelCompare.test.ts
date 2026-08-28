import { describe, expect, it } from "vitest";
import { buildPlayerDuelComparison, buildPlayerDuelOptions } from "../playerDuelCompare";
import type { WvWReport } from "../../types/report";

const report = {
  meta: {
    id: "night-1",
    title: "Reset night",
    commanders: [],
    dateStart: "2026-08-28",
    dateEnd: "2026-08-28",
    dateLabel: "Aug 28",
    generatedAt: "2026-08-28",
    appVersion: "test",
  },
  stats: {
    total: 1,
    leaderboards: {
      dodges: [
        { rank: 1, account: "Alpha.1234", profession: "Revenant", professionList: ["Revenant"], value: 14, count: 1 },
        { rank: 2, account: "Beta.5678", profession: "Guardian", professionList: ["Guardian"], value: 9, count: 1 },
      ],
      stability: [
        { rank: 1, account: "Beta.5678", profession: "Guardian", professionList: ["Guardian"], value: 120, count: 1 },
      ],
    },
    offensePlayers: [
      {
        account: "Alpha.1234",
        profession: "Revenant",
        professionList: ["Revenant"],
        totalFightMs: 60000,
        offenseRateWeights: {},
        offenseTotals: { damage: 600000, powerDamage: 420000, conditionDamage: 180000, directDmg: 410000, connectedDamageCount: 0, connectedDirectDamageCount: 0, criticalRate: 0, criticalDmg: 120000, flankingRate: 0, glanceRate: 0, missed: 0, evaded: 0, blocked: 0, interrupts: 4, invulned: 0, killed: 3, downed: 8, againstDownedDamage: 0, appliedCrowdControl: 15, appliedCrowdControlDuration: 0, appliedCrowdControlDownContribution: 0, appliedCrowdControlDurationDownContribution: 0, downContribution: 10, boonStrips: 30, battleStandardHits: 0 },
      },
      {
        account: "Beta.5678",
        profession: "Guardian",
        professionList: ["Guardian"],
        totalFightMs: 60000,
        offenseRateWeights: {},
        offenseTotals: { damage: 450000, powerDamage: 450000, conditionDamage: 0, directDmg: 450000, connectedDamageCount: 0, connectedDirectDamageCount: 0, criticalRate: 0, criticalDmg: 90000, flankingRate: 0, glanceRate: 0, missed: 0, evaded: 0, blocked: 0, interrupts: 1, invulned: 0, killed: 2, downed: 6, againstDownedDamage: 0, appliedCrowdControl: 8, appliedCrowdControlDuration: 0, appliedCrowdControlDownContribution: 0, appliedCrowdControlDurationDownContribution: 0, downContribution: 7, boonStrips: 5, battleStandardHits: 0 },
      },
    ],
    supportPlayers: [
      { account: "Alpha.1234", profession: "Revenant", professionList: ["Revenant"], activeMs: 60000, logsJoined: 1, supportTotals: { condiCleanse: 18, condiCleanseTime: 0, condiCleanseSelf: 0, condiCleanseTimeSelf: 0, boonStripsTime: 0, boonStripDownContribution: 0, boonStripDownContributionTime: 0, stunBreak: 2, removedStunDuration: 0, resurrects: 0, resurrectTime: 0, boonStrips: 30 } },
      { account: "Beta.5678", profession: "Guardian", professionList: ["Guardian"], activeMs: 60000, logsJoined: 1, supportTotals: { condiCleanse: 42, condiCleanseTime: 0, condiCleanseSelf: 0, condiCleanseTimeSelf: 0, boonStripsTime: 0, boonStripDownContribution: 0, boonStripDownContributionTime: 0, stunBreak: 1, removedStunDuration: 0, resurrects: 2, resurrectTime: 0, boonStrips: 5 } },
    ],
    healingPlayers: [
      { account: "Alpha.1234", profession: "Revenant", professionList: ["Revenant"], activeMs: 60000, hasHealAddon: true, healingCoverage: "full", healingTotals: { healing: 100000, squadHealing: 70000, groupHealing: 60000, selfHealing: 30000, offSquadHealing: 0, barrier: 10000, squadBarrier: 8000, groupBarrier: 7000, selfBarrier: 2000, downedHealing: 1000, squadDownedHealing: 900, groupDownedHealing: 800, healingPowerHealing: 40000, squadHealingPowerHealing: 30000, conversionHealing: 20000, squadConversionHealing: 15000, hybridHealing: 40000, squadHybridHealing: 25000 } },
      { account: "Beta.5678", profession: "Guardian", professionList: ["Guardian"], activeMs: 60000, hasHealAddon: true, healingCoverage: "full", healingTotals: { healing: 180000, squadHealing: 150000, groupHealing: 130000, selfHealing: 30000, offSquadHealing: 0, barrier: 40000, squadBarrier: 35000, groupBarrier: 30000, selfBarrier: 5000, downedHealing: 4000, squadDownedHealing: 3000, groupDownedHealing: 2000, healingPowerHealing: 160000, squadHealingPowerHealing: 140000, conversionHealing: 0, squadConversionHealing: 0, hybridHealing: 20000, squadHybridHealing: 10000 } },
    ],
    defensePlayers: [
      { account: "Alpha.1234", profession: "Revenant", professionList: ["Revenant"], totalFightMs: 60000, defenseTotals: { damageTaken: 80000, minionDamageTaken: 0, damageTakenCount: 0, conditionDamageTaken: 30000, conditionDamageTakenCount: 0, powerDamageTaken: 50000, powerDamageTakenCount: 0, downCount: 1, deadCount: 0, blockedCount: 5, evadedCount: 4, damageBarrier: 12000 } },
      { account: "Beta.5678", profession: "Guardian", professionList: ["Guardian"], totalFightMs: 60000, defenseTotals: { damageTaken: 120000, minionDamageTaken: 0, damageTakenCount: 0, conditionDamageTaken: 40000, conditionDamageTakenCount: 0, powerDamageTaken: 80000, powerDamageTakenCount: 0, downCount: 2, deadCount: 1, blockedCount: 12, evadedCount: 1, damageBarrier: 22000 } },
    ],
    generalPlayers: [
      { account: "Alpha.1234", profession: "Revenant", professionList: ["Revenant"], totalFightMs: 60000, squadActiveMs: 60000, totalDist: 900, distCount: 30, logsJoined: 1, stackedLogCount: 1 },
      { account: "Beta.5678", profession: "Guardian", professionList: ["Guardian"], totalFightMs: 60000, squadActiveMs: 60000, totalDist: 1200, distCount: 30, logsJoined: 1, stackedLogCount: 0 },
    ],
    damageMitigationPlayers: [
      { account: "Alpha.1234", name: "Alpha", profession: "Revenant", professionList: ["Revenant"], activeMs: 60000, mitigationTotals: { totalHits: 9, blocked: 5, evaded: 4, glanced: 0, missed: 0, invulned: 0, interrupted: 0, totalMitigation: 55000, minMitigation: 30000, isEstimated: true } },
    ],
    conditionPlayers: [
      { account: "Alpha.1234", profession: "Revenant", professionList: ["Revenant"], totalFightMs: 60000, squadActiveMs: 60000, logsJoined: 1, outgoingConditions: { Torment: { applications: 20, damage: 45000, skills: {} } }, incomingConditions: {} },
      { account: "Beta.5678", profession: "Guardian", professionList: ["Guardian"], totalFightMs: 60000, squadActiveMs: 60000, logsJoined: 1, outgoingConditions: {}, incomingConditions: { Burning: { applications: 12, damage: 15000, skills: {} } } },
    ],
    playerSkillBreakdowns: {
      "Alpha.1234": { account: "Alpha.1234", profession: "Revenant", professionList: ["Revenant"], damage: [{ id: "1", name: "Coalescence of Ruin", value: 160000, hits: 12, downContribution: 3 }], healing: [{ id: "2", name: "Vengeful Hammers", value: 20000, hits: 8 }], barrier: [] },
      "Beta.5678": { account: "Beta.5678", profession: "Guardian", professionList: ["Guardian"], damage: [{ id: "3", name: "Symbol of Vengeance", value: 90000, hits: 18 }], healing: [{ id: "4", name: "Empower", value: 70000, hits: 10 }], barrier: [{ id: "5", name: "Chapter 3", value: 24000, hits: 6 }] },
    },
  },
} as unknown as WvWReport;

describe("player duel compare", () => {
  it("discovers player options across metric sources", () => {
    expect(buildPlayerDuelOptions([report]).map((option) => option.account)).toEqual(["Alpha.1234", "Beta.5678"]);
  });

  it("builds all-metric head-to-head rows with correct better direction metadata", () => {
    const comparison = buildPlayerDuelComparison([report], "Alpha.1234", "Beta.5678");
    expect(comparison.metrics.find((metric) => metric.key === "damage")).toMatchObject({ a: 600000, b: 450000, direction: "higher" });
    expect(comparison.metrics.find((metric) => metric.key === "deaths")).toMatchObject({ a: 0, b: 1, direction: "lower" });
    expect(comparison.metrics.find((metric) => metric.key === "dodges")).toMatchObject({ a: 14, b: 9, direction: "neutral" });
  });

  it("merges skill, healing, barrier, condition, and mitigation sources", () => {
    const comparison = buildPlayerDuelComparison([report], "Alpha.1234", "Beta.5678");
    expect(comparison.breakdown.damageSkills.map((row) => row.name)).toContain("Coalescence of Ruin");
    expect(comparison.breakdown.healingSkills.map((row) => row.name)).toContain("Empower");
    expect(comparison.breakdown.barrierSkills[0]).toMatchObject({ name: "Chapter 3", b: 24000 });
    expect(comparison.breakdown.outgoingConditions[0]).toMatchObject({ name: "Torment", a: 45000, aHits: 20 });
    expect(comparison.metrics.find((metric) => metric.key === "estimatedMitigation")).toMatchObject({ a: 55000, b: 0 });
  });
});
