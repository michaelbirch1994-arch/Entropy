import { describe, expect, it } from "vitest";
import {
  BUILDER_ARMOR_SLOT_ICONS,
  BUILDER_TRINKET_SLOT_ICONS,
  builderWeaponIcon,
} from "../gw2/builderEquipmentVisuals";

describe("Builder equipment visuals", () => {
  it("provides artwork for every modeled armor and trinket slot", () => {
    expect(Object.keys(BUILDER_ARMOR_SLOT_ICONS)).toEqual(["head", "shoulders", "chest", "hands", "legs", "feet"]);
    expect(Object.keys(BUILDER_TRINKET_SLOT_ICONS)).toEqual(["backpack", "amulet", "ring1", "ring2", "accessory1", "accessory2"]);
  });

  it("normalizes API weapon names and aquatic aliases", () => {
    expect(builderWeaponIcon("Greatsword")).toContain("Bandit_Sunderer.png");
    expect(builderWeaponIcon("Short Bow")).toContain("Bandit_Short_Bow.png");
    expect(builderWeaponIcon("HarpoonGun")).toContain("Bandit_Harpoon_Gun.png");
    expect(builderWeaponIcon("Speargun")).toContain("Bandit_Harpoon_Gun.png");
    expect(builderWeaponIcon("Unknown weapon")).toBeUndefined();
  });
});
