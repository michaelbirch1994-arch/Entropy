import { describe, expect, it } from "vitest";
import { computeAttributeProfile, computeAttributeTotals } from "../gw2/computeAttributes";
import { createEmptyBuilder } from "../axiforge/builderModel";
import type { EntropyBuilderState, Gw2Profession } from "../../types/buildEditor";

// Minimal Gw2Profession fixtures -- only the fields computeAttributeTotals
// (via isTwoHandedWeapon) actually reads: id + weapons[].flags.
function makeProfession(id: string): Gw2Profession {
    return {
          id,
          name: id,
          specializations: [],
          skills: [],
          weapons: {
                  Sword: { flags: ["Mainhand"] },
                  Focus: { flags: ["Offhand"] },
                  Greatsword: { flags: ["TwoHand"] },
          },
    };
}

function equipFullSet(builder: EntropyBuilderState, statPackage: string, weapon: "oneHand" | "twoHand") {
    builder.equipment.statPackage = statPackage;
    if (weapon === "oneHand") {
          builder.equipment.weapons.mainhand1 = "Sword";
          builder.equipment.weapons.offhand1 = "Focus";
    } else {
          builder.equipment.weapons.mainhand1 = "Greatsword";
          builder.equipment.weapons.offhand1 = "";
    }
    return builder;
}

function equipRuneSet(builder: EntropyBuilderState, runeId: string) {
    builder.equipment.runes = {
          head: runeId,
          shoulders: runeId,
          chest: runeId,
          hands: runeId,
          legs: runeId,
          feet: runeId,
    };
    return builder;
}

describe("computeAttributeTotals", () => {
    it("returns base 1000 primary stats with no gear and no profession passed", () => {
          const builder = createEmptyBuilder("Guardian");
          const totals = computeAttributeTotals(builder, null);

           expect(totals.power).toBe(1000);
          expect(totals.precision).toBe(1000);
          expect(totals.toughness).toBe(1000);
          expect(totals.vitality).toBe(1000);
          expect(totals.concentration).toBe(0);
          expect(totals.conditionDamage).toBe(0);
          expect(totals.expertise).toBe(0);
          expect(totals.ferocity).toBe(0);
          expect(totals.healingPower).toBe(0);
          // Guardian base health (1645) + 1000 Vitality * 10.
           expect(totals.health).toBe(11645);
          expect(totals.critChance).toBe(5);
          expect(totals.critDamage).toBe(150);
          expect(totals.boonDuration).toBe(0);
          expect(totals.conditionDuration).toBe(0);
    });

           it("uses the correct base health tier per profession", () => {
                 const cases: Array<[string, number]> = [
                         ["Warrior", 9212],
                         ["Necromancer", 9212],
                         ["Revenant", 5922],
                         ["Engineer", 5922],
                         ["Ranger", 5922],
                         ["Mesmer", 5922],
                         ["Guardian", 1645],
                         ["Thief", 1645],
                         ["Elementalist", 1645],
                       ];
                 for (const [professionId, expectedBase] of cases) {
                         const builder = createEmptyBuilder(professionId);
                         const totals = computeAttributeTotals(builder, null);
                         expect(totals.health).toBe(expectedBase + 1000 * 10);
                 }
           });

           it("falls back to a passed-in Gw2Profession id over builder.professionId for health", () => {
                 const builder = createEmptyBuilder("Guardian");
                 const totals = computeAttributeTotals(builder, makeProfession("Warrior"));
                 expect(totals.health).toBe(9212 + 1000 * 10);
           });

           it("computes a fully-geared one-handed Berserker's Guardian correctly (hand-verified)", () => {
                 const builder = equipFullSet(createEmptyBuilder("Guardian"), "Berserker's", "oneHand");
                 const profession = makeProfession("Guardian");
                 const totals = computeAttributeTotals(builder, profession);

                  expect(totals.power).toBe(2381);
                 expect(totals.precision).toBe(1961);
                 expect(totals.ferocity).toBe(961);
                 expect(totals.toughness).toBe(1000);
                 expect(totals.vitality).toBe(1000);
                 expect(totals.conditionDamage).toBe(0);
                 expect(totals.expertise).toBe(0);
                 expect(totals.concentration).toBe(0);
                 expect(totals.healingPower).toBe(0);
                 expect(totals.health).toBe(11645);
                 expect(totals.critChance).toBeCloseTo(50.7619, 3);
                 expect(totals.critDamage).toBeCloseTo(214.0667, 3);
                 expect(totals.boonDuration).toBe(0);
                 expect(totals.conditionDuration).toBe(0);
           });

           it("applies the two-handed weapon budget once instead of the one-handed budget twice", () => {
                 const builder = equipFullSet(createEmptyBuilder("Guardian"), "Berserker's", "twoHand");
                 const profession = makeProfession("Guardian");
                 const totals = computeAttributeTotals(builder, profession);

                  // Same as the one-handed case but with the twoHand budget (251/179)
                  // swapped in for the oneHand budget applied twice (125+125 / 90+90).
                  expect(totals.power).toBe(2382);
                 expect(totals.precision).toBe(1960);
                 expect(totals.ferocity).toBe(960);
           });

           it("splits a single major attribute across two minor attributes (Harrier's boon duration)", () => {
                 const builder = equipFullSet(createEmptyBuilder("Guardian"), "Harrier's", "oneHand");
                 const totals = computeAttributeTotals(builder, makeProfession("Guardian"));

                  expect(totals.power).toBe(2381);
                 expect(totals.healingPower).toBe(961);
                 expect(totals.concentration).toBe(961);
                 expect(totals.boonDuration).toBeCloseTo(961 / 15, 6);
                 expect(totals.conditionDuration).toBe(0);
           });

           it("uses the 4-stat budget table and drives condition duration for a two-major stat (Viper's)", () => {
                 const builder = equipFullSet(createEmptyBuilder("Necromancer"), "Viper's", "oneHand");
                 const totals = computeAttributeTotals(builder, makeProfession("Necromancer"));

                  expect(totals.power).toBe(2173);
                 expect(totals.conditionDamage).toBe(1173);
                 expect(totals.precision).toBe(1633);
                 expect(totals.expertise).toBe(633);
                 expect(totals.conditionDuration).toBeCloseTo(633 / 15, 6);
                 expect(totals.critChance).toBeCloseTo(5 + 633 / 21, 6);
           });

           it("spreads Celestial's flat bonus across all nine attributes", () => {
                 const builder = equipFullSet(createEmptyBuilder("Guardian"), "Celestial", "oneHand");
                 const totals = computeAttributeTotals(builder, makeProfession("Guardian"));

                  expect(totals.power).toBe(1639);
                 expect(totals.precision).toBe(1639);
                 expect(totals.toughness).toBe(1639);
                 expect(totals.vitality).toBe(1639);
                 expect(totals.concentration).toBe(639);
                 expect(totals.conditionDamage).toBe(639);
                 expect(totals.expertise).toBe(639);
                 expect(totals.ferocity).toBe(639);
                 expect(totals.healingPower).toBe(639);
                 expect(totals.health).toBe(1645 + 1639 * 10);
                 expect(totals.critChance).toBeCloseTo(5 + 639 / 21, 6);
                 expect(totals.critDamage).toBeCloseTo(150 + 639 / 15, 6);
                 expect(totals.boonDuration).toBeCloseTo(639 / 15, 6);
                 expect(totals.conditionDuration).toBeCloseTo(639 / 15, 6);
           });

           it("ignores an unrecognized stat package name and leaves stats at base", () => {
                 const builder = equipFullSet(createEmptyBuilder("Guardian"), "NotARealStatName", "oneHand");
                 const totals = computeAttributeTotals(builder, makeProfession("Guardian"));
                 expect(totals.power).toBe(1000);
                 expect(totals.precision).toBe(1000);
           });

           it("uses per-slot trinket and weapon stat overrides when present", () => {
                 const builder = equipFullSet(createEmptyBuilder("Guardian"), "Berserker's", "oneHand");
                 builder.equipment.slots.amulet = "Harrier's";
                 builder.equipment.slots.mainhand1 = "Harrier's";
                 const totals = computeAttributeTotals(builder, makeProfession("Guardian"));

                 expect(totals.power).toBe(2381);
                 expect(totals.precision).toBe(1961 - 108 - 90);
                 expect(totals.ferocity).toBe(961 - 108 - 90);
                 expect(totals.healingPower).toBe(108 + 90);
                 expect(totals.concentration).toBe(108 + 90);
           });

           it("uses the active weapon set for weapon stats", () => {
                 const builder = equipFullSet(createEmptyBuilder("Guardian"), "Berserker's", "oneHand");
                 builder.equipment.weapons.mainhand2 = "Greatsword";
                 builder.equipment.weapons.offhand2 = "";
                 builder.equipment.slots.mainhand2 = "Harrier's";
                 builder.activeWeaponSet = 2;
                 const totals = computeAttributeTotals(builder, makeProfession("Guardian"));

                 expect(totals.power).toBe(2382);
                 expect(totals.precision).toBe(1961 - 90 - 90);
                 expect(totals.ferocity).toBe(961 - 90 - 90);
                 expect(totals.healingPower).toBe(179);
                 expect(totals.concentration).toBe(179);
           });

           it("returns a tactical profile with contribution groups and active set identity", () => {
                 const builder = equipFullSet(createEmptyBuilder("Guardian"), "Berserker's", "oneHand");
                 builder.equipment.slots.amulet = "Harrier's";
                 const profile = computeAttributeProfile(builder, makeProfession("Guardian"));

                 expect(profile.totals.power).toBe(2381);
                 expect(profile.activeWeaponSet).toBe(1);
                 expect(profile.equippedSlots).toBe(14);
                 expect(profile.totalSlots).toBe(14);
                 expect(profile.primaryIdentity).toBe("strike");
                 expect(profile.pressure.strike).toBeGreaterThan(profile.pressure.support);

                 const base = profile.contributions.find((entry) => entry.source === "base");
                 const trinkets = profile.contributions.find((entry) => entry.source === "trinket");
                 const weapons = profile.contributions.find((entry) => entry.source === "weapon");

                 expect(base?.stats.Power).toBe(1000);
                 expect(trinkets?.stats.HealingPower).toBe(108);
                 expect(weapons?.label).toBe("Weapon set I");
                 expect(weapons?.stats.Power).toBe(250);
           });

           it("scores a Minstrel support build as support/sustain instead of strike pressure", () => {
                 const builder = equipFullSet(createEmptyBuilder("Guardian"), "Minstrel's", "oneHand");
                 const profile = computeAttributeProfile(builder, makeProfession("Guardian"));

                 expect(profile.pressure.support).toBeGreaterThan(profile.pressure.strike);
                 expect(profile.pressure.sustain).toBeGreaterThan(profile.pressure.strike);
                 expect(["support", "sustain"]).toContain(profile.primaryIdentity);
           });

           it("includes full rune sets, food, and utility conversions as tactical contribution groups", () => {
                 const builder = equipRuneSet(equipFullSet(createEmptyBuilder("Guardian"), "Berserker's", "oneHand"), "24836");
                 builder.equipment.food = "Peppercorn-Crusted Sous-Vide Steak";
                 builder.equipment.utility = "Superior Sharpening Stone";
                 const profile = computeAttributeProfile(builder, makeProfession("Guardian"));

                 expect(profile.totals.precision).toBe(1961);
                 expect(profile.totals.ferocity).toBe(1256);
                 expect(profile.totals.power).toBe(2790);

                 expect(profile.contributions.find((entry) => entry.source === "rune")?.stats).toMatchObject({ Power: 175, Ferocity: 225 });
                 expect(profile.contributions.find((entry) => entry.source === "food")?.stats).toMatchObject({ Power: 100, Ferocity: 70 });
                 expect(profile.contributions.find((entry) => entry.source === "utility")?.stats).toMatchObject({ Power: 134 });
           });

           it("uses support rune and maintenance oil bonuses in boon/healing pressure", () => {
                 const builder = equipRuneSet(equipFullSet(createEmptyBuilder("Guardian"), "Minstrel's", "oneHand"), "24842");
                 builder.equipment.food = "Mint-Pear Cured Meat Flatbread";
                 builder.equipment.utility = "Furious Maintenance Oil";
                 const profile = computeAttributeProfile(builder, makeProfession("Guardian"));

                 expect(profile.totals.healingPower).toBe(1173 + 300 + 100 + 30);
                 expect(profile.totals.concentration).toBe(633 + 225 + 70 + 30);
                 expect(profile.totals.boonDuration).toBeCloseTo(profile.totals.concentration / 15, 6);
                 expect(profile.pressure.support).toBeGreaterThan(profile.pressure.strike);
           });
});
