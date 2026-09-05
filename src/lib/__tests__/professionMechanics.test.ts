import { describe, expect, it } from "vitest";
import type { Gw2Legend, Gw2Pet, Gw2Profession, Gw2Skill, Gw2Specialization } from "../../types/buildEditor";
import { createEmptyBuilder } from "../axiforge/builderModel";
import {
  availableRevenantLegends,
  resolveProfessionMechanicSlots,
  resolveRangerPetSlots,
  resolveRevenantLegendSlots,
  validateRevenantLegendSelection,
} from "../gw2/professionMechanics";

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

  it("maps only explicitly selected terrestrial Ranger pets", () => {
    const builder = createEmptyBuilder("Ranger");
    builder.selectedPets.terrestrial1 = 4;
    builder.selectedPets.terrestrial2 = 99;
    const pets: Gw2Pet[] = [{ id: 4, name: "Juvenile Jungle Stalker", icon: "stalker.png" }];

    expect(resolveRangerPetSlots(builder, pets)).toEqual([
      { key: "P1", pet: pets[0] },
      { key: "P2", pet: null },
    ]);
    expect(resolveRangerPetSlots(createEmptyBuilder("Guardian"), pets)).toEqual([]);
  });

  it("offers core Revenant legends plus only the active elite legend", () => {
    const legends: Gw2Legend[] = [
      { id: "Legend2", swap: 28134 },
      { id: "Legend5", swap: 41858 },
      { id: "Legend7", swap: 62749 },
    ];
    const legendSkills = new Map<number, Gw2Skill>([
      [28134, { id: 28134, name: "Legendary Assassin Stance", slot: "Profession_1" }],
      [41858, { id: 41858, name: "Legendary Renegade Stance", slot: "Profession_1", specialization: 63 }],
      [62749, { id: 62749, name: "Legendary Alliance", slot: "Profession_1", specialization: 69 }],
    ]);
    expect(availableRevenantLegends(legends, [null, null, 69], legendSkills).map((legend) => legend.id)).toEqual(["Legend2", "Legend7"]);

    const builder = createEmptyBuilder("Revenant");
    builder.specializationIds = [null, null, 69];
    builder.selectedLegends = ["Legend2", "Legend5"];
    expect(resolveRevenantLegendSlots(builder, legends, legendSkills)).toEqual([
      { key: "L1", legend: legends[0], skill: legendSkills.get(28134) },
      { key: "L2", legend: legends[1], skill: legendSkills.get(41858) },
    ]);
    expect(validateRevenantLegendSelection(builder, legends, legendSkills)).toEqual([
      "Legendary Renegade Stance is not available to the selected specializations.",
    ]);
  });
});
