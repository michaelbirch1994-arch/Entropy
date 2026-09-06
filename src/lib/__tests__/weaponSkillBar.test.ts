import { describe, expect, it } from "vitest";
import { createEmptyBuilder } from "../axiforge/builderModel";
import { resolveWeaponSkillSlots } from "../gw2/weaponSkillBar";
import type { Gw2Profession, Gw2Skill } from "../../types/buildEditor";

function profession(): Gw2Profession {
  return {
    id: "Test",
    name: "Test",
    specializations: [],
    skills: [],
    weapons: {
      Sword: {
        flags: ["Mainhand"],
        skills: [
          { id: 11, slot: "Weapon_1" },
          { id: 12, slot: "Weapon_2" },
          { id: 13, slot: "Weapon_3", offhand: "Dagger" },
          { id: 14, slot: "Weapon_3", offhand: "Nothing" },
        ],
      },
      Dagger: {
        flags: ["Offhand"],
        skills: [{ id: 24, slot: "Weapon_4" }, { id: 25, slot: "Weapon_5" }],
      },
      Staff: {
        flags: ["TwoHand"],
        skills: [1, 2, 3, 4, 5].map((slot) => ({ id: 30 + slot, slot: `Weapon_${slot}` })),
      },
      Scepter: {
        flags: ["Mainhand"],
        skills: [
          { id: 41, slot: "Weapon_1", attunement: "Fire" },
          { id: 42, slot: "Weapon_1", attunement: "Water" },
        ],
      },
      Axe: {
        specialization: 99,
        flags: ["Mainhand"],
        skills: [{ id: 51, slot: "Weapon_1" }],
      },
    },
  };
}

describe("resolveWeaponSkillSlots", () => {
  it("combines mainhand slots 1-3 with offhand slots 4-5", () => {
    const builder = createEmptyBuilder("Test");
    builder.equipment.weapons.mainhand1 = "Sword";
    builder.equipment.weapons.offhand1 = "Dagger";
    expect(resolveWeaponSkillSlots(builder, profession(), 1).map((skill) => skill?.id ?? null)).toEqual([11, 12, 13, 24, 25]);
  });

  it("uses the unpaired dual skill and leaves unavailable slots empty", () => {
    const builder = createEmptyBuilder("Test");
    builder.equipment.weapons.mainhand1 = "Sword";
    expect(resolveWeaponSkillSlots(builder, profession(), 1).map((skill) => skill?.id ?? null)).toEqual([11, 12, 14, null, null]);
  });

  it("uses all five slots from a two-handed weapon", () => {
    const builder = createEmptyBuilder("Test");
    builder.equipment.weapons.mainhand2 = "Staff";
    expect(resolveWeaponSkillSlots(builder, profession(), 2).map((skill) => skill?.id ?? null)).toEqual([31, 32, 33, 34, 35]);
  });

  it("prefers Guardian land spear skills when the API entry also contains aquatic skills", () => {
    const builder = createEmptyBuilder("Guardian");
    builder.equipment.weapons.mainhand1 = "Spear";
    const guardian: Gw2Profession = {
      id: "Guardian",
      name: "Guardian",
      specializations: [],
      skills: [],
      weapons: {
        Spear: {
          flags: ["TwoHand", "Aquatic"],
          skills: [
            { id: 9189, slot: "Weapon_1" }, { id: 73055, slot: "Weapon_1" },
            { id: 9190, slot: "Weapon_2" }, { id: 72940, slot: "Weapon_2" },
            { id: 72978, slot: "Weapon_3" }, { id: 9191, slot: "Weapon_3" },
            { id: 73094, slot: "Weapon_4" }, { id: 9192, slot: "Weapon_4" },
            { id: 73132, slot: "Weapon_5" }, { id: 9193, slot: "Weapon_5" },
          ],
        },
      },
    };
    const skillsById = new Map<number, Gw2Skill>([
      [9189, { id: 9189, name: "Spear of Light", slot: "Profession", flags: [] }],
      [73055, { id: 73055, name: "Daybreaking Slash", slot: "Profession", flags: ["NoUnderwater"] }],
      [9190, { id: 9190, name: "Zealot's Flurry", slot: "Profession", flags: [] }],
      [72940, { id: 72940, name: "Helio Rush", slot: "Profession", flags: ["GroundTargeted", "NoUnderwater"] }],
      [72978, { id: 72978, name: "Gleaming Disc", slot: "Profession", flags: ["NoUnderwater"] }],
      [9191, { id: 9191, name: "Brilliance", slot: "Profession", flags: [] }],
      [73094, { id: 73094, name: "Solar Storm", slot: "Profession", flags: ["GroundTargeted", "NoUnderwater"] }],
      [9192, { id: 9192, name: "Symbol of Spears", slot: "Profession", flags: [] }],
      [73132, { id: 73132, name: "Symbol of Luminance", slot: "Profession", flags: ["NoUnderwater"] }],
      [9193, { id: 9193, name: "Wrathful Grasp", slot: "Profession", flags: [] }],
    ]);

    expect(resolveWeaponSkillSlots(builder, guardian, 1, skillsById).map((skill) => skill?.id ?? null)).toEqual([
      73055, 72940, 72978, 73094, 73132,
    ]);
  });

  it("selects the active attunement", () => {
    const builder = createEmptyBuilder("Test");
    builder.equipment.weapons.mainhand1 = "Scepter";
    builder.activeAttunement = "Water";
    expect(resolveWeaponSkillSlots(builder, profession(), 1)[0]?.id).toBe(42);
  });

  it("uses skill metadata to select a matching dual-attunement skill", () => {
    const builder = createEmptyBuilder("Test");
    const testProfession = profession();
    testProfession.weapons!.Scepter.skills!.push({ id: 43, slot: "Weapon_1", attunement: "Water" });
    builder.equipment.weapons.mainhand1 = "Scepter";
    builder.specializationIds[0] = 99;
    builder.activeAttunement = "Water";
    builder.activeAttunement2 = "Earth";
    const skillsById = new Map<number, Gw2Skill>([
      [43, { id: 43, name: "Dual skill", slot: "Profession", specialization: 99, dual_attunement: "Earth" }],
    ]);
    expect(resolveWeaponSkillSlots(builder, testProfession, 1, skillsById)[0]?.id).toBe(43);
  });

  it("does not expose specialization weapons without the specialization", () => {
    const builder = createEmptyBuilder("Test");
    builder.equipment.weapons.mainhand1 = "Axe";
    expect(resolveWeaponSkillSlots(builder, profession(), 1)[0]).toBeNull();
    builder.specializationIds[0] = 99;
    expect(resolveWeaponSkillSlots(builder, profession(), 1)[0]?.id).toBe(51);
  });
});
