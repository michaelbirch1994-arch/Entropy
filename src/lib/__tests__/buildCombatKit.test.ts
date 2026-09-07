import { describe, expect, it } from "vitest";
import type { Gw2Legend, Gw2Pet, Gw2Profession, Gw2Skill, Gw2Specialization, Gw2Trait } from "../../types/buildEditor";
import { createEmptyBuilder } from "../axiforge/builderModel";
import { resolveBuildCombatSkillIds, resolveSelectedTraits } from "../axiforge/buildCombatKit";

const guardian: Gw2Profession = {
  id: "Guardian",
  name: "Guardian",
  specializations: [62],
  skills: [{ id: 70, slot: "Profession_1" }],
  weapons: {
    Sword: { flags: ["Mainhand"], skills: [{ id: 11, slot: "Weapon_1" }] },
    Staff: { flags: ["TwoHand"], skills: [{ id: 21, slot: "Weapon_1" }] },
  },
};

describe("build combat kit resolution", () => {
  it("resolves selected major traits plus every minor trait", () => {
    const builder = createEmptyBuilder("Guardian");
    builder.specializationIds = [62, null, null];
    builder.traitChoices[0] = [2, 0, 0];
    const specializations: Gw2Specialization[] = [{
      id: 62, name: "Firebrand", profession: "Guardian", elite: true,
      minor_traits: [101], major_traits: [201, 202, 203],
    }];
    const traits: Gw2Trait[] = [
      { id: 101, name: "Minor", specialization: 62, tier: 1, order: 0, slot: "Minor" },
      { id: 201, name: "Top", specialization: 62, tier: 1, order: 0, slot: "Major" },
      { id: 202, name: "Middle", specialization: 62, tier: 1, order: 1, slot: "Major" },
      { id: 203, name: "Bottom", specialization: 62, tier: 1, order: 2, slot: "Major" },
    ];

    expect(resolveSelectedTraits(builder, specializations, traits).map(({ id }) => id)).toEqual([101, 202]);
  });

  it("includes selected utilities, both weapon sets, and profession mechanics", () => {
    const builder = createEmptyBuilder("Guardian");
    builder.healSkillId = 1;
    builder.utilitySkillIds = [2, 3, null];
    builder.eliteSkillId = 4;
    builder.equipment.weapons.mainhand1 = "Sword";
    builder.equipment.weapons.mainhand2 = "Staff";
    const skills = new Map<number, Gw2Skill>([1, 2, 3, 4, 11, 21, 70].map((id) => [id, {
      id, name: `Skill ${id}`, slot: id === 70 ? "Profession_1" : "Profession",
    }]));

    expect(resolveBuildCombatSkillIds(builder, guardian, [], skills)).toEqual([1, 2, 3, 4, 11, 21, 70]);
  });

  it("includes selected Revenant legend and Ranger pet skills", () => {
    const revenant = createEmptyBuilder("Revenant");
    revenant.selectedLegends = ["Legend2", "Legend5"];
    const legends: Gw2Legend[] = [
      { id: "Legend2", swap: 80, heal: 81, utilities: [82, 83], elite: 84 },
      { id: "Legend7", swap: 90, heal: 91 },
    ];
    expect(resolveBuildCombatSkillIds(revenant, null, [], new Map(), legends)).toEqual([80, 81, 82, 83, 84]);

    const ranger = createEmptyBuilder("Ranger");
    ranger.selectedPets.terrestrial1 = 7;
    const pets: Gw2Pet[] = [
      { id: 7, name: "Selected", skills: [{ id: 101 }, { id: 102 }] },
      { id: 8, name: "Other", skills: [{ id: 103 }] },
    ];
    expect(resolveBuildCombatSkillIds(ranger, null, [], new Map(), [], pets)).toEqual([101, 102]);
  });
});
