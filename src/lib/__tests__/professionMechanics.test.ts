import { describe, expect, it } from "vitest";
import type { Gw2Legend, Gw2Pet, Gw2Profession, Gw2Skill, Gw2Specialization } from "../../types/buildEditor";
import { createEmptyBuilder } from "../axiforge/builderModel";
import {
  availableRevenantLegends,
  resolveProfessionMechanicSlots,
  resolveRangerPetSlots,
  resolveRevenantLegendSlots,
  resolveWarriorMechanicSkills,
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

  it("resolves explicit Engineer elite mechanic buttons", () => {
    const engineer: Gw2Profession = { ...profession, id: "Engineer", name: "Engineer", skills: [
      { id: 42938, slot: "Profession_5" },
      { id: 41123, slot: "Profession_5" },
    ] };
    const holosmithSpecs = new Map<number, Gw2Specialization>([[57, {
      id: 57, name: "Holosmith", profession: "Engineer", elite: true, major_traits: [], minor_traits: [],
    }]]);
    const engineerSkills = new Map<number, Gw2Skill>([
      [42938, { id: 42938, name: "Engage Photon Forge", slot: "Profession_5", specialization: 57, flip_skill: 41123 }],
      [41123, { id: 41123, name: "Deactivate Photon Forge", slot: "Profession_5", specialization: 57 }],
    ]);
    const builder = createEmptyBuilder("Engineer");
    builder.specializationIds = [57, null, null];

    expect(resolveProfessionMechanicSlots(builder, engineer, holosmithSpecs, engineerSkills))
      .toEqual([{ key: "F5", skill: engineerSkills.get(42938)! }]);
  });

  it("resolves equipped Warrior bursts for core and Berserker builds", () => {
    const warrior: Gw2Profession = { ...profession, id: "Warrior", name: "Warrior", skills: [
      { id: 14353, slot: "Profession_1" },
      { id: 14375, slot: "Profession_1" },
      { id: 30851, slot: "Profession_1" },
      { id: 29852, slot: "Profession_1" },
      { id: 30435, slot: "Profession_2" },
      { id: 30185, slot: "Profession_2" },
    ] };
    const warriorSkills = new Map<number, Gw2Skill>([
      [14353, { id: 14353, name: "Eviscerate", slot: "Profession_1", weapon_type: "Axe" }],
      [14375, { id: 14375, name: "Arcing Slice", slot: "Profession_1", weapon_type: "Greatsword" }],
      [30851, { id: 30851, name: "Decapitate", slot: "Profession_1", weapon_type: "Axe", specialization: 18 }],
      [29852, { id: 29852, name: "Arc Divider", slot: "Profession_1", weapon_type: "Greatsword", specialization: 18 }],
      [30435, { id: 30435, name: "Berserk", slot: "Profession_2", weapon_type: "None", specialization: 18, facts: [{ type: "Recharge", text: "Recharge", value: 8 }] }],
      [30185, { id: 30185, name: "Berserk", slot: "Profession_2", weapon_type: "None", specialization: 18, facts: [{ type: "Recharge", text: "Recharge", value: 15 }] }],
    ]);
    const builder = createEmptyBuilder("Warrior");
    builder.equipment.weapons.mainhand1 = "Axe";
    builder.equipment.weapons.mainhand2 = "Greatsword";

    expect(resolveWarriorMechanicSkills(builder, warrior, warriorSkills).map(({ name }) => name))
      .toEqual(["Eviscerate", "Arcing Slice"]);

    builder.specializationIds = [18, null, null];
    builder.gameMode = "wvw";
    expect(resolveWarriorMechanicSkills(builder, warrior, warriorSkills).map(({ id }) => id))
      .toEqual([30851, 29852, 30185]);
  });

  it("adds Paragon chants alongside its equipped core burst", () => {
    const warrior: Gw2Profession = { ...profession, id: "Warrior", name: "Warrior", skills: [
      { id: 14353, slot: "Profession_1" },
      { id: 77342, slot: "Profession_2" },
      { id: 76782, slot: "Profession_3" },
      { id: 77155, slot: "Profession_4" },
    ] };
    const warriorSkills = new Map<number, Gw2Skill>([
      [14353, { id: 14353, name: "Eviscerate", slot: "Profession_1", weapon_type: "Axe" }],
      [77342, { id: 77342, name: "Chant of Action", slot: "Profession_2", weapon_type: "None", specialization: 74 }],
      [76782, { id: 76782, name: "Chant of Recuperation", slot: "Profession_3", weapon_type: "None", specialization: 74 }],
      [77155, { id: 77155, name: "Chant of Freedom", slot: "Profession_4", weapon_type: "None", specialization: 74 }],
    ]);
    const builder = createEmptyBuilder("Warrior");
    builder.specializationIds = [74, null, null];
    builder.equipment.weapons.mainhand1 = "Axe";

    expect(resolveWarriorMechanicSkills(builder, warrior, warriorSkills).map(({ name }) => name))
      .toEqual(["Eviscerate", "Chant of Action", "Chant of Recuperation", "Chant of Freedom"]);
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
