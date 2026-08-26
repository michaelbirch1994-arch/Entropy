import { describe, expect, it } from "vitest";
import type { FightRow } from "../../types/report";
import { buildCompositionComparison, summarizeProfessionPresence } from "../compositionInsights";

describe("composition insights", () => {
  it("compares squad profiles and enemy observations by normalized share", () => {
    const rows = buildCompositionComparison(
      [
        { name: "Firebrand", value: 3, color: "blue" },
        { name: "Reaper", value: 1, color: "green" },
      ],
      [
        { name: "Firebrand", value: 2, color: "blue" },
        { name: "Reaper", value: 6, color: "green" },
      ],
    );

    expect(rows.find((row) => row.name === "Reaper")).toEqual(expect.objectContaining({
      squadPct: 25,
      enemyPct: 75,
      deltaPct: 50,
    }));
    expect(rows.find((row) => row.name === "Firebrand")?.deltaPct).toBe(-50);
  });

  it("keeps a profession that exists on only one side", () => {
    const rows = buildCompositionComparison(
      [{ name: "Scourge", value: 2, color: "green" }],
      [{ name: "Tempest", value: 4, color: "red" }],
    );

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Scourge", squadCount: 2, enemyCount: 0 }),
      expect.objectContaining({ name: "Tempest", squadCount: 0, enemyCount: 4 }),
    ]));
  });

  it("summarizes profession coverage across fights", () => {
    const fights = [
      { squadClassCountsFight: { Firebrand: 2 } },
      { squadClassCountsFight: { Firebrand: 1 } },
      { squadClassCountsFight: {} },
      { squadClassCountsFight: { Firebrand: 3 } },
    ] as FightRow[];

    expect(summarizeProfessionPresence(fights, "Firebrand")).toEqual({
      totalFights: 4,
      fightsPresent: 3,
      fightsAbsent: 1,
      coveragePct: 75,
      averagePerFight: 1.5,
      peakCount: 3,
    });
  });
});
