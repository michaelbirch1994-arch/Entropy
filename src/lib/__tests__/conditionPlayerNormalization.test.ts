import { describe, expect, it } from "vitest";
import { normalizeConditionPlayers } from "../conditionPlayerNormalization";
import type { ConditionPlayer } from "../../types/report";

function legacyRows(): ConditionPlayer[] {
  return [
    {
      account: "Player.1234",
      profession: "Guardian",
      professionList: ["Guardian"],
      totalFightMs: 60_000,
      squadActiveMs: 55_000,
      logsJoined: 2,
      outgoingConditions: {
        Burning: {
          icon: "burn.png",
          applications: 4,
          damage: 1000,
          applicationsFromBuffs: 1,
          applicationsFromBuffsActive: 1,
          uptimeMs: 10_000,
          skills: {
            "1": { name: "Shared Burn", hits: 2, damage: 700, icon: "skill.png" },
            "2": { name: "Guard Burn", hits: 1, damage: 300 },
          },
        },
      },
      incomingConditions: {
        Weakness: {
          applications: 2,
          damage: 0,
          uptimeMs: 4_000,
          skills: {
            "9": { name: "Enemy Weakness", hits: 2, damage: 0 },
          },
        },
      },
    },
    {
      account: "Player.1234",
      profession: "Necromancer",
      professionList: ["Necromancer"],
      totalFightMs: 40_000,
      squadActiveMs: 35_000,
      logsJoined: 2,
      outgoingConditions: {
        Burning: {
          applications: 3,
          damage: 600,
          applicationsFromBuffs: 2,
          applicationsFromBuffsActive: 1,
          uptimeMs: 6_000,
          skills: {
            "1": { name: "Shared Burn", hits: 1, damage: 200 },
            "3": { name: "Necro Burn", hits: 2, damage: 400 },
          },
        },
        Poison: {
          applications: 5,
          damage: 800,
          uptimeMs: 8_000,
          skills: {
            "4": { name: "Poison Skill", hits: 3, damage: 800 },
          },
        },
      },
      incomingConditions: {
        Weakness: {
          applications: 1,
          damage: 0,
          uptimeMs: 2_000,
          skills: {
            "9": { name: "Enemy Weakness", hits: 1, damage: 0 },
          },
        },
      },
    },
  ];
}

describe("normalizeConditionPlayers", () => {
  it("combines legacy profession slices, nested skills, sample time, and fight count", () => {
    const rows = normalizeConditionPlayers(legacyRows(), 3);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      account: "Player.1234",
      profession: "Guardian",
      totalFightMs: 100_000,
      squadActiveMs: 90_000,
      logsJoined: 3,
    });
    expect(rows[0].professionList).toEqual(expect.arrayContaining(["Guardian", "Necromancer"]));

    expect(rows[0].outgoingConditions.Burning).toMatchObject({
      applications: 7,
      damage: 1600,
      applicationsFromBuffs: 3,
      applicationsFromBuffsActive: 2,
      uptimeMs: 16_000,
    });
    expect(rows[0].outgoingConditions.Burning.skills["1"]).toMatchObject({
      name: "Shared Burn",
      hits: 3,
      damage: 900,
      icon: "skill.png",
    });
    expect(rows[0].outgoingConditions.Burning.skills["2"]).toMatchObject({ hits: 1, damage: 300 });
    expect(rows[0].outgoingConditions.Burning.skills["3"]).toMatchObject({ hits: 2, damage: 400 });
    expect(rows[0].outgoingConditions.Poison).toMatchObject({ applications: 5, damage: 800, uptimeMs: 8_000 });

    expect(rows[0].incomingConditions.Weakness).toMatchObject({ applications: 3, damage: 0, uptimeMs: 6_000 });
    expect(rows[0].incomingConditions.Weakness.skills["9"]).toMatchObject({ hits: 3, damage: 0 });
  });

  it("keeps a modern one-row condition player numerically unchanged", () => {
    const row = legacyRows()[0];
    expect(normalizeConditionPlayers([row], 3)).toEqual([row]);
  });
});
