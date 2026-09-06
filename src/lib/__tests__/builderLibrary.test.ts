import { describe, expect, it } from "vitest";
import { createEmptyBuilder } from "../axiforge/builderModel";
import { matchesBuilderLibraryFilters, type BuilderLibraryFilters } from "../axiforge/builderLibrary";
import type { Gw2Specialization, SavedBuilderBuild } from "../../types/buildEditor";

const specsById = new Map<number, Gw2Specialization>([
  [18, { id: 18, name: "Berserker", profession: "Warrior", elite: true, major_traits: [], minor_traits: [] }],
]);

function buildFixture(): SavedBuilderBuild {
  const state = createEmptyBuilder("Warrior");
  state.name = "Frontline Burst";
  state.role = "Power DPS";
  state.gameMode = "wvw";
  state.specializationIds = [null, null, 18];
  state.tags = ["zerg", "spike"];
  return {
    id: "frontline-burst",
    name: state.name,
    createdAt: "2026-09-05T00:00:00.000Z",
    updatedAt: "2026-09-05T00:00:00.000Z",
    shareCode: "",
    state,
  };
}

const emptyFilters: BuilderLibraryFilters = {
  query: "",
  profession: "",
  specialization: "",
  role: "",
  mode: "",
  tag: "",
};

describe("matchesBuilderLibraryFilters", () => {
  it("matches search text across build, profession, role, specialization, and tags", () => {
    const build = buildFixture();
    for (const query of ["frontline", "warrior", "power", "berserker", "spike"]) {
      expect(matchesBuilderLibraryFilters(build, { ...emptyFilters, query }, specsById)).toBe(true);
    }
    expect(matchesBuilderLibraryFilters(build, { ...emptyFilters, query: "support" }, specsById)).toBe(false);
  });

  it("combines structured filters without changing the saved build", () => {
    const build = buildFixture();
    const original = structuredClone(build);
    expect(matchesBuilderLibraryFilters(build, {
      query: "burst",
      profession: "Warrior",
      specialization: "18",
      role: "Power DPS",
      mode: "wvw",
      tag: "zerg",
    }, specsById)).toBe(true);
    expect(matchesBuilderLibraryFilters(build, { ...emptyFilters, mode: "pve" }, specsById)).toBe(false);
    expect(build).toEqual(original);
  });
});
