import { describe, expect, it } from "vitest";
import { createEmptyBuilder } from "../axiforge/builderModel";
import {
  AQUATIC_ONLY_RANGER_PET_IDS,
  availableProfessionSkills,
  availableProfessionWeapons,
  isTerrestrialRangerPet,
  isTwoHandedWeapon,
  validateBuilderEquipmentAgainstCatalog,
  validateBuilderSkillsAgainstCatalog,
  weaponFitsBuilderSlot,
} from "../gw2/builderCatalog";
import type { Gw2Profession, Gw2Skill } from "../../types/buildEditor";

const profession: Gw2Profession = {
  id: "Guardian",
  name: "Guardian",
  specializations: [42],
  skills: [],
  weapons: {
    Sword: { flags: ["Mainhand"] },
    Shield: { flags: ["Offhand"] },
    Greatsword: { flags: ["TwoHand"] },
    Rifle: { flags: ["TwoHand"], specialization: 42 },
  },
};

describe("Builder foundation catalog", () => {
  it("offers core skills plus only the active specialization skills", () => {
    const skills: Gw2Skill[] = [
      { id: 1, name: "Core Heal", slot: "Heal" },
      { id: 2, name: "Dragonhunter Heal", slot: "Heal", specialization: 27 },
      { id: 3, name: "Firebrand Heal", slot: "Heal", specialization: 62 },
    ];
    expect(availableProfessionSkills(skills, [null, null, 62]).map((skill) => skill.id)).toEqual([1, 3]);
    expect(availableProfessionSkills(skills, [null, null, null]).map((skill) => skill.id)).toEqual([1]);

    const builder = createEmptyBuilder("Guardian");
    builder.specializationIds = [null, null, 62];
    builder.healSkillId = 2;
    expect(validateBuilderSkillsAgainstCatalog(builder, skills)).toEqual([
      "Dragonhunter Heal is not available to the selected specializations.",
    ]);
  });

  it("separates aquatic-only pets without excluding amphibious land pets", () => {
    expect([...AQUATIC_ONLY_RANGER_PET_IDS]).toEqual([21, 40, 41, 42, 43]);
    expect(isTerrestrialRangerPet(21)).toBe(false);
    expect(isTerrestrialRangerPet(40)).toBe(false);
    expect(isTerrestrialRangerPet(7)).toBe(true);
    expect(isTerrestrialRangerPet(66)).toBe(true);
  });

  it("only exposes specialization weapons when that specialization is selected", () => {
    expect(availableProfessionWeapons(profession, [null, null, null]).map(([name]) => name)).not.toContain("Rifle");
    expect(availableProfessionWeapons(profession, [42, null, null]).map(([name]) => name)).toContain("Rifle");
  });

  it("maps profession weapon flags onto Builder equipment slots", () => {
    expect(weaponFitsBuilderSlot(profession.weapons!.Sword, "mainhand1")).toBe(true);
    expect(weaponFitsBuilderSlot(profession.weapons!.Sword, "offhand1")).toBe(false);
    expect(weaponFitsBuilderSlot(profession.weapons!.Shield, "offhand2")).toBe(true);
    expect(isTwoHandedWeapon(profession, "greatsword")).toBe(true);
  });

  it("reports unavailable, wrong-slot, and two-handed offhand combinations without mutating the build", () => {
    const builder = createEmptyBuilder("Guardian");
    builder.equipment.weapons.mainhand1 = "greatsword";
    builder.equipment.weapons.offhand1 = "shield";
    builder.equipment.weapons.mainhand2 = "shield";
    builder.equipment.weapons.offhand2 = "rifle";

    const issues = validateBuilderEquipmentAgainstCatalog(builder, profession);

    expect(issues).toContain("Remove the weapon set I offhand while using a two-handed weapon.");
    expect(issues).toContain("shield cannot be equipped in mainhand2.");
    expect(issues).toContain("rifle is not available to this profession and specialization setup.");
    expect(builder.equipment.weapons.offhand1).toBe("shield");
  });
});
