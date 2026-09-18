import { describe, expect, it, vi } from "vitest";
import { createEmptyBuilder } from "../axiforge/builderModel";
import { importGw2SkillsForEffectivePower, type EffectivePowerImportDependencies } from "../effectivePower/importBuild";
import { effectivePowerInputFromNormalizedBuild, NORMALIZED_DAMAGE_BUILD_SCHEMA } from "../effectivePower/normalizedBuild";

function importedBuilder() {
  const builder = createEmptyBuilder("Guardian");
  builder.name = "Imported frontline";
  builder.gameMode = "wvw";
  builder.equipment.statPackage = "Berserker's";
  builder.equipment.slots = {
    head: "Berserker's",
    shoulders: "Berserker's",
    chest: "Berserker's",
    hands: "Berserker's",
    legs: "Berserker's",
    feet: "Berserker's",
    backpack: "Berserker's",
    amulet: "Berserker's",
    ring1: "Berserker's",
    ring2: "Berserker's",
    accessory1: "Berserker's",
    accessory2: "Berserker's",
    mainhand1: "Berserker's",
  };
  builder.equipment.weapons.mainhand1 = "greatsword";
  builder.equipment.infusions.head = "49424";
  return builder;
}

describe("Effective Power build import boundary", () => {
  it("normalizes a gw2skills build through official records and the wiki-backed attribute engine", async () => {
    const builder = importedBuilder();
    const dependencies: EffectivePowerImportDependencies = {
      importGw2SkillsBuild: vi.fn().mockResolvedValue({
        state: builder,
        warnings: ["Imported source warning."],
        sourceUrl: "https://en.gw2skills.net/editor/?example",
      }),
      fetchItemStats: vi.fn().mockResolvedValue([{ id: 1, name: "Berserker's" }]),
      fetchLegends: vi.fn().mockResolvedValue([]),
      fetchProfessions: vi.fn().mockResolvedValue([{ id: "Guardian", name: "Guardian", specializations: [], skills: [], weapons: { Greatsword: { flags: ["TwoHand"] } } }]),
      fetchItems: vi.fn().mockResolvedValue([{ id: 49424, name: "+5 Power Infusion", details: { infix_upgrade: { attributes: [{ attribute: "Power", modifier: 5 }] } } }]),
      now: () => "2026-09-17T12:00:00.000Z",
    };

    const result = await importGw2SkillsForEffectivePower("https://en.gw2skills.net/editor/?example", dependencies);

    expect(result.schema).toBe(NORMALIZED_DAMAGE_BUILD_SCHEMA);
    expect(result.professionId).toBe("Guardian");
    expect(result.source).toMatchObject({ kind: "gw2skills", label: "gw2skills.net", importedAt: "2026-09-17T12:00:00.000Z" });
    expect(result.attributes.power).toBeGreaterThan(1000);
    expect(result.attributes.precision).toBeGreaterThan(1000);
    expect(result.attributes.ferocity).toBeGreaterThan(0);
    expect(result.attributes.provenance).toBe("entropy-wiki-equipment-model+gw2-api-items");
    expect(result.source.warnings).toContain("Imported source warning.");
    expect(dependencies.fetchItems).toHaveBeenCalledWith([49424]);
  });

  it("adapts normalized attributes without blending combat assumptions into the build", async () => {
    const builder = importedBuilder();
    const dependencies: EffectivePowerImportDependencies = {
      importGw2SkillsBuild: vi.fn().mockResolvedValue({ state: builder, warnings: [], sourceUrl: "https://en.gw2skills.net/editor/?example" }),
      fetchItemStats: vi.fn().mockResolvedValue([]),
      fetchLegends: vi.fn().mockResolvedValue([]),
      fetchProfessions: vi.fn().mockResolvedValue([]),
      fetchItems: vi.fn().mockResolvedValue([]),
      now: () => "2026-09-17T12:00:00.000Z",
    };
    const normalized = await importGw2SkillsForEffectivePower("https://en.gw2skills.net/editor/?example", dependencies);
    const input = effectivePowerInputFromNormalizedBuild(normalized, {
      furyUptimePercent: 80,
      mightStacks: 20,
      mightUptimePercent: 75,
      vulnerabilityStacks: 18,
    });

    expect(input).toMatchObject({
      power: normalized.attributes.power,
      precision: normalized.attributes.precision,
      ferocity: normalized.attributes.ferocity,
      gameMode: "wvw",
      furyUptimePercent: 80,
      mightStacks: 20,
      mightUptimePercent: 75,
      vulnerabilityStacks: 18,
      strikeDamageModifierPercent: 0,
    });
  });
});
