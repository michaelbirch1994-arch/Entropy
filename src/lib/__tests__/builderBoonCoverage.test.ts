import { describe, expect, it } from "vitest";
import { analyzeBuildBoons, enrichedFactsForEntity, isProvidedEffectFact } from "../axiforge/boonEngine";
import { createEmptyBuilder, createSavedBuild } from "../axiforge/builderModel";
import { mergeLiveBuildForCoverage } from "../axiforge/squadBoons";
import type { Gw2Skill } from "../../types/buildEditor";

describe("builder squad boon coverage", () => {
  it("detects an ally boon supplied by a selected utility skill", () => {
    const utility = {
      id: 123,
      name: "Stand Together",
      description: "Grant stability to nearby allies.",
      facts: [
        { type: "Buff", status: "Stability", duration: 5 },
        { type: "Recharge", value: 20 },
      ],
    } as Gw2Skill;

    const coverage = analyzeBuildBoons([utility], [], 0);

    expect(coverage).toEqual([
      expect.objectContaining({
        name: "Stability",
        hasAllySource: true,
        estimatedUptimePercent: 25,
        sources: [expect.objectContaining({ sourceName: "Stand Together", type: "skill" })],
      }),
    ]);
  });

  it("uses the active edited build as a live squad-coverage snapshot", () => {
    const saved = createSavedBuild(createEmptyBuilder("Guardian"), "");
    const draft = {
      ...saved.state,
      name: "Live support draft",
      utilitySkillIds: [123, null, null] as [number | null, number | null, number | null],
    };

    const merged = mergeLiveBuildForCoverage([saved], saved.id, draft);

    expect(merged[0].state.utilitySkillIds).toEqual([123, null, null]);
    expect(merged[0].name).toBe("Live support draft");
    expect(merged[0].updatedAt).toContain(":draft:");
    expect(mergeLiveBuildForCoverage([saved], null, draft)).toBeDefined();
    expect(mergeLiveBuildForCoverage([saved], null, draft)[0]).toBe(saved);
  });

  it("enriches Tale of the Soulkeeper with its mode-specific provided boons", () => {
    const skill = {
      id: 76850,
      name: "Tale of the Soulkeeper",
      description: "Rouse allies with the legend of Almorra Soulkeeper, granting offensive boons.",
      facts: [{ type: "Recharge", value: 30 }],
    } as Gw2Skill;

    expect(enrichedFactsForEntity(skill, "wvw")).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "Recharge", value: 30 }),
      expect.objectContaining({ status: "Might", apply_count: 10, duration: 6 }),
      expect.objectContaining({ status: "Fury", duration: 6 }),
      expect.objectContaining({ status: "Quickness", duration: 3 }),
    ]));
    expect(enrichedFactsForEntity(skill, "wvw")).not.toContainEqual(expect.objectContaining({ type: "Recharge", value: 20 }));

    const coverage = analyzeBuildBoons([skill], [], 0, "wvw");
    expect(coverage.map((entry) => entry.name)).toEqual(["Fury", "Might", "Quickness"]);
    expect(coverage.every((entry) => entry.hasAllySource)).toBe(true);
  });

  it("recognizes non-boon status facts for the skill detail panel", () => {
    expect(isProvidedEffectFact({ type: "ApplyBuffCondition", status: "Burning", duration: 4 })).toBe(true);
    expect(isProvidedEffectFact({ type: "Recharge", value: 20 })).toBe(false);
  });
});
