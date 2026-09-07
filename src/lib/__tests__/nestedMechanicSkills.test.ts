import { describe, expect, it } from "vitest";
import { analyzeBuildBoons } from "../axiforge/boonEngine";
import { createEmptyBuilder } from "../axiforge/builderModel";
import { resolveNestedMechanicSkills } from "../axiforge/nestedMechanicSkills";

describe("nested profession mechanic skills", () => {
  it("adds the complete Firebrand tome kit when Firebrand is active", () => {
    const build = createEmptyBuilder("Guardian");
    build.specializationIds = [62, null, null];

    const skills = resolveNestedMechanicSkills(build);

    expect(skills).toHaveLength(15);
    expect(skills.map(({ name }) => name)).toContain("Chapter 4: Stalwart Stand");
  });

  it("includes Firebrand tome ally boons in WvW coverage", () => {
    const build = createEmptyBuilder("Guardian");
    build.specializationIds = [62, null, null];

    const coverage = analyzeBuildBoons(resolveNestedMechanicSkills(build), [], 0, "wvw");
    const resistance = coverage.find(({ name }) => name === "Resistance");

    expect(resistance).toMatchObject({ hasAllySource: true, estimatedUptimePercent: 15 });
    expect(resistance?.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceName: "Chapter 4: Stalwart Stand", duration: 3, recharge: 20 }),
    ]));
    expect(coverage.find(({ name }) => name === "Stability")?.hasAllySource).toBe(true);
  });

  it("does not add Firebrand chapters for a core Guardian", () => {
    expect(resolveNestedMechanicSkills(createEmptyBuilder("Guardian"))).toEqual([]);
  });
});
