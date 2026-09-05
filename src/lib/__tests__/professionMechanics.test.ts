import { describe, expect, it } from "vitest";
import type { Gw2Profession, Gw2Skill, Gw2Specialization } from "../../types/buildEditor";
import { createEmptyBuilder } from "../axiforge/builderModel";
import { resolveProfessionMechanicSlots } from "../gw2/professionMechanics";

const profession: Gw2Profession = {
  id: "Guardian",
  name: "Guardian",
  specializations: [62],
  skills: [
    { id: 9115, slot: "Profession_1" },
    { id: 9120, slot: "Profession_2" },
    { id: 44364, slot: "Profession_1" },
    { id: 41780, slot: "Profession_2" },
    { id: 42259, slot: "Profession_3" },
    { id: 42371, slot: "Profession_3" },
    { id: 41380, slot: "Profession_1" },
  ],
};
const specs = new Map<number, Gw2Specialization>([[62, {
  id: 62, name: "Firebrand", profession: "Guardian", elite: true, major_traits: [], minor_traits: [],
}]]);
const skills = new Map<number, Gw2Skill>([
  [9115, { id: 9115, name: "Virtue of Justice", slot: "Profession_1" }],
  [9120, { id: 9120, name: "Virtue of Resolve", slot: "Profession_2" }],
  [44364, { id: 44364, name: "Tome of Justice", slot: "Profession_1", specialization: 62, flip_skill: 68647 }],
  [41780, { id: 41780, name: "Tome of Resolve", slot: "Profession_2", specialization: 62, flip_skill: 68648 }],
  [42259, { id: 42259, name: "Tome of Courage", slot: "Profession_3", specialization: 62, flip_skill: 68650 }],
  [42371, { id: 42371, name: "Tome of Courage", slot: "Profession_3", specialization: 62 }],
  [41380, { id: 41380, name: "Stow Tome", slot: "Profession_1", specialization: 62 }],
]);

describe("resolveProfessionMechanicSlots", () => {
  it("renders core slots when no elite specialization is active", () => {
    const result = resolveProfessionMechanicSlots(createEmptyBuilder("Guardian"), profession, specs, skills);
    expect(result.map(({ key, skill }) => [key, skill.id])).toEqual([["F1", 9115], ["F2", 9120]]);
  });

  it("replaces core slots with explicit active elite mechanics", () => {
    const builder = createEmptyBuilder("Guardian");
    builder.specializationIds = [null, null, 62];
    const result = resolveProfessionMechanicSlots(builder, profession, specs, skills);
    expect(result.map(({ key, skill }) => [key, skill.id])).toEqual([
      ["F1", 44364], ["F2", 41780], ["F3", 42259],
    ]);
  });

  it("does not substitute core mechanics for an unresolved elite specialization", () => {
    const builder = createEmptyBuilder("Guardian");
    builder.specializationIds = [null, null, 27];
    const dragonhunterSpecs = new Map(specs).set(27, { ...specs.get(62)!, id: 27, name: "Dragonhunter" });
    expect(resolveProfessionMechanicSlots(builder, profession, dragonhunterSpecs, skills)).toEqual([]);
  });

  it("leaves state-derived profession mechanics to dedicated resolvers", () => {
    const warrior = { ...profession, id: "Warrior", name: "Warrior" };
    expect(resolveProfessionMechanicSlots(createEmptyBuilder("Warrior"), warrior, new Map(), skills)).toEqual([]);
  });
});
