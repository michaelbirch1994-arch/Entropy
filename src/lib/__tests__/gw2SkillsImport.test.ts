import { describe, expect, it } from "vitest";
import { createEmptyBuilder } from "../axiforge/builderModel";
import { applyGw2SkillsEquipment, parseGw2SkillsPreload, validateGw2SkillsEditorUrl } from "../gw2/gw2SkillsImport";

describe("gw2skills import boundary", () => {
  it("accepts only complete public editor URLs", () => {
    expect(validateGw2SkillsEditorUrl("https://en.gw2skills.net/editor/?ABC-w").hostname).toBe("en.gw2skills.net");
    expect(() => validateGw2SkillsEditorUrl("https://gw2skills.net.evil.example/editor/?ABC")).toThrow(/only public/i);
    expect(() => validateGw2SkillsEditorUrl("https://en.gw2skills.net/wiki/?ABC")).toThrow(/complete/i);
  });

  it("parses the restricted preload object without executing page JavaScript", () => {
    const preload = parseGw2SkillsPreload(`before preload: { qlink: 'abc', chatlink: "DQY=", mode: "wvw", trait: [[1,2,3],], equipment: { relic: 272, }, } after`);
    expect(preload).toMatchObject({ qlink: "abc", chatlink: "DQY=", mode: "wvw", equipment: { relic: 272 } });
  });

  it("maps equipment catalog labels into Entropy's editable equipment state", () => {
    const database = {
      profile: { rows: [{ id: 191, profile: 32 }] },
      prfltype: { rows: [{ id: 32, name: "Marauder" }] },
      weapon: { rows: [{ id: 9, name: "Dagger" }] },
      upgrade: { rows: [
        { id: 178, name: "the Deadeye" },
        { id: 76, name: "Frenzy" },
        { id: 272, name: "Relic of Fireworks" },
        { id: 386, name: "+1 Agony Infusion" },
        { id: 901, name: "Experienced Enrichment" },
      ] },
      buff: { rows: [{ id: 535, name: "Peppercorn-Crusted Sous-Vide Steak" }] },
    };
    const preload = {
      weapon: [9],
      equipment: {
        armor: { helm: { item: [191, 1], up: [[178, 0]], inf: [[386, 0]] } },
        weapon: { w11: { item: [191, 1], up: [[76, 0]], inf: [[386, 0]] } },
        trinket: {
          amulet: { item: [191, 1], up: [[901, 0]] },
          earring1: { item: [191, 1], inf: [[386, 0]] },
        },
        relic: 272,
        buff: { food: 535 },
      },
    };
    const result = applyGw2SkillsEquipment(createEmptyBuilder("Elementalist"), preload, database, ["Marauder's"]);
    expect(result.state.equipment.statPackage).toBe("Marauder's");
    expect(result.state.equipment.weapons.mainhand1).toBe("dagger");
    expect(result.state.equipment.runes.head).toBe("82791");
    expect(result.state.equipment.sigils.mainhand1).toEqual(["82876"]);
    expect(result.state.equipment.slots.accessory1).toBe("Marauder's stats");
    expect(result.state.equipment.infusions.head).toBe("49424");
    expect(result.state.equipment.infusions.mainhand1).toEqual(["49424"]);
    expect(result.state.equipment.infusions.accessory1).toBe("49424");
    expect(result.state.equipment.enrichment).toBe("39330");
    expect(result.state.equipment.relic).toBe("Relic of Fireworks");
    expect(result.state.equipment.food).toBe("Peppercorn-Crusted Sous-Vide Steak");
  });

  it("maps the compact positional rows used by the live gw2skills catalog", () => {
    const database = {
      profile: {
        desc: ["id", "img", "profile", "rarity"],
        rows: [[191, "", 32, 6]],
      },
      prfltype: {
        desc: ["id", "key", "name", "name_loc"],
        rows: [[32, "marauder", "Marauder", "Marauder"]],
      },
      weapon: {
        desc: ["id", "key", "name", "name_loc"],
        rows: [[9, "dagger", "Dagger", "Dagger"]],
      },
      upgrade: {
        desc: ["id", "img", "rarity", "type", "name", "name_loc"],
        rows: [[76, "", 6, 0, "Frenzy", "Frenzy"]],
      },
    };
    const result = applyGw2SkillsEquipment(
      createEmptyBuilder("Elementalist"),
      { weapon: [9], equipment: { weapon: { w11: { item: [191, 1], up: [[76, 0]] } } } },
      database,
      ["Marauder's"],
    );
    expect(result.state.equipment.statPackage).toBe("Marauder's");
    expect(result.state.equipment.weapons.mainhand1).toBe("dagger");
    expect(result.state.equipment.sigils.mainhand1).toEqual(["82876"]);
  });
});
