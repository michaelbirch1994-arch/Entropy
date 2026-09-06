import { describe, expect, it } from "vitest";
import { createEmptyEquipment } from "../axiforge/builderModel";
import {
  BUILDER_FOOD_CHOICES,
  BUILDER_ENRICHMENT_CHOICES,
  BUILDER_RELIC_CHOICES,
  BUILDER_RUNE_CHOICES,
  BUILDER_SIGIL_CHOICES,
  BUILDER_UTILITY_CHOICES,
  choiceIsCodecSupported,
  equipmentItemIds,
} from "../gw2/builderEquipmentCatalog";

describe("Builder equipment catalog", () => {
  it("exposes the exact codec-backed named choices", () => {
    expect(BUILDER_RELIC_CHOICES).toContain("Relic of the Thief");
    expect(BUILDER_FOOD_CHOICES.find((choice) => choice.id === 41569)?.label).toBe("Bowl of Sweet and Spicy Butternut Squash Soup");
    expect(BUILDER_UTILITY_CHOICES.find((choice) => choice.id === 78305)?.label).toBe("Superior Sharpening Stone");
    expect(BUILDER_RELIC_CHOICES).toHaveLength(106);
    expect(BUILDER_FOOD_CHOICES).toHaveLength(14);
    expect(BUILDER_UTILITY_CHOICES).toHaveLength(5);
    expect(choiceIsCodecSupported("Relic of Galdra", BUILDER_RELIC_CHOICES)).toBe(false);
  });

  it("keeps the verified upgrade catalogs complete and duplicate-free", () => {
    expect(BUILDER_RUNE_CHOICES).toHaveLength(99);
    expect(BUILDER_SIGIL_CHOICES).toHaveLength(81);
    expect(BUILDER_ENRICHMENT_CHOICES).toHaveLength(15);
    for (const choices of [BUILDER_RUNE_CHOICES, BUILDER_SIGIL_CHOICES, BUILDER_ENRICHMENT_CHOICES]) {
      expect(new Set(choices.map((choice) => choice.id)).size).toBe(choices.length);
    }
  });

  it("collects only valid unique item IDs without mutating equipment", () => {
    const equipment = createEmptyEquipment();
    equipment.runes.head = "24836";
    equipment.runes.chest = "24836";
    equipment.sigils.mainhand1 = ["24615", "not-an-id", "24868"];
    equipment.infusions.head = ["49432", "not-an-id"];
    equipment.relic = "Relic of the Thief";
    equipment.food = "Bowl of Sweet and Spicy Butternut Squash Soup";
    equipment.utility = "Superior Sharpening Stone";
    equipment.enrichment = "49432";

    expect(equipmentItemIds(equipment)).toEqual([24836, 24615, 24868, 49432, 100916, 41569, 78305]);
    expect(equipment.sigils.mainhand1).toEqual(["24615", "not-an-id", "24868"]);
  });

  it("distinguishes lossless legacy text from codec-supported choices", () => {
    expect(choiceIsCodecSupported("Relic of the Thief", BUILDER_RELIC_CHOICES)).toBe(true);
    expect(choiceIsCodecSupported("Imported future relic", BUILDER_RELIC_CHOICES)).toBe(false);
    expect(choiceIsCodecSupported("", BUILDER_RELIC_CHOICES)).toBe(true);
  });
});
