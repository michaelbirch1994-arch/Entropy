import { describe, expect, it } from "vitest";
import type { Gw2Skill } from "../../types/buildEditor";
import { analyzeBuildBoons } from "../axiforge/boonEngine";
import { createEmptyBuilder } from "../axiforge/builderModel";
import { analyzeBuildConditions } from "../axiforge/conditionEngine";
import {
  nestedMechanicSkillIds,
  resolveNestedMechanicSkills,
} from "../axiforge/nestedMechanicSkills";
import { analyzeBuildUtility } from "../axiforge/utilityEngine";

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

  it("loads the complete Reaper shroud bar from the API catalog", () => {
    const build = createEmptyBuilder("Necromancer");
    build.specializationIds = [34, null, null];
    const ids = nestedMechanicSkillIds(build);
    const skillsById = new Map<number, Gw2Skill>(ids.map((id) => [id, {
      id,
      name: id === 30504 ? "Soul Spiral" : id === 30825 ? "Death's Charge" : `Shroud ${id}`,
      description: id === 30825 ? "Slide forward, destroying projectiles in your path. Blind foes at your destination." : "",
      slot: "Profession",
      facts: id === 30504 ? [{ type: "Buff", status: "Poisoned", duration: 2, apply_count: 12 }] : [],
    } as Gw2Skill]));

    const skills = resolveNestedMechanicSkills(build, skillsById);

    expect(skills).toHaveLength(7);
    expect(analyzeBuildConditions(skills, []).find(({ name }) => name === "Poison")?.sources)
      .toEqual(expect.arrayContaining([expect.objectContaining({ sourceName: "Soul Spiral" })]));
    expect(analyzeBuildUtility(skills, []).map(({ kind }) => kind).includes("projectileDefense")).toBe(true);
  });

  it("loads all Tempest overloads and includes their ally support", () => {
    const build = createEmptyBuilder("Elementalist");
    build.specializationIds = [48, null, null];
    const ids = nestedMechanicSkillIds(build);
    const skillsById = new Map<number, Gw2Skill>(ids.map((id) => [id, {
      id,
      name: id === 29415 ? "Overload Water" : `Overload ${id}`,
      description: id === 29415 ? "Heal and cleanse allies, then apply regeneration." : "",
      slot: "Profession",
      facts: id === 29415 ? [
        { type: "Buff", status: "Regeneration", duration: 8 },
        { type: "Number", text: "Conditions Removed per Pulse", value: 1 },
      ] : [],
    } as Gw2Skill]));

    const skills = resolveNestedMechanicSkills(build, skillsById);

    expect(skills).toHaveLength(4);
    expect(analyzeBuildBoons(skills, []).find(({ name }) => name === "Regeneration")?.hasAllySource).toBe(true);
    expect(analyzeBuildUtility(skills, []).map(({ kind }) => kind).includes("cleanse")).toBe(true);
  });

  it.each([
    ["Ranger", 5, 5, "Celestial Avatar"],
    ["Necromancer", 64, 5, "Harbinger Shroud"],
    ["Necromancer", 76, 5, "Ritualist's Shroud"],
  ])("loads the complete %s nested bar for specialization %i", (profession, specializationId, expectedCount, label) => {
    const build = createEmptyBuilder(profession);
    build.specializationIds = [specializationId, null, null];
    const ids = nestedMechanicSkillIds(build);
    const skillsById = new Map<number, Gw2Skill>(ids.map((id, index) => [id, {
      id,
      name: `${label} ${index + 1}`,
      slot: `Profession_${index + 1}`,
    } as Gw2Skill]));

    expect(resolveNestedMechanicSkills(build, skillsById)).toHaveLength(expectedCount);
  });

  it("includes Druid avatar cleanse and healing in squad utility", () => {
    const build = createEmptyBuilder("Ranger");
    build.specializationIds = [5, null, null];
    const skillsById = new Map<number, Gw2Skill>([
      [31406, {
        id: 31406,
        name: "Seed of Life",
        slot: "Profession_2",
        description: "Summon a seed that heals and cleanses nearby allies of conditions.",
        facts: [
          { type: "AttributeAdjust", text: "Healing", value: 216 },
          { type: "Number", text: "Conditions Removed", value: 2 },
        ],
      }],
    ]);

    expect(analyzeBuildUtility(resolveNestedMechanicSkills(build, skillsById), []).map(({ kind }) => kind))
      .toEqual(["cleanse", "healing"]);
  });

  it("fills the missing WvW facts for Ritualist Preservation", () => {
    const build = createEmptyBuilder("Necromancer");
    build.specializationIds = [76, null, null];
    build.gameMode = "wvw";
    const skillsById = new Map<number, Gw2Skill>([[76684, {
      id: 76684,
      name: "Preservation",
      slot: "Profession_4",
      description: "Grant boons to nearby allies, then heal and remove conditions from nearby allies.",
    }]]);

    const skills = resolveNestedMechanicSkills(build, skillsById);
    const boons = analyzeBuildBoons(skills, [], 0, "wvw");

    expect(boons.find(({ name }) => name === "Protection")).toMatchObject({
      hasAllySource: true,
      estimatedUptimePercent: 12.5,
    });
    expect(boons.find(({ name }) => name === "Vigor")?.hasAllySource).toBe(true);
    expect(analyzeBuildUtility(skills, []).map(({ kind }) => kind)).toEqual(["cleanse", "healing"]);
  });
});
