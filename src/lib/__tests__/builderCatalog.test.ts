import { describe, expect, it } from "vitest";
import { createEmptyBuilder } from "../axiforge/builderModel";
import {
  availableProfessionWeapons,
  isTwoHandedWeapon,
  validateBuilderEquipmentAgainstCatalog,
  weaponFitsBuilderSlot,
} from "../gw2/builderCatalog";
import type { Gw2Profession } from "../../types/buildEditor";

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
