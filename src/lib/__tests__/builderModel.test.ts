import { describe, expect, it } from "vitest";
import { decodeAxiForgeCode, encodeAxiForgeBuildCode, encodeAxiForgeCompCode } from "../axiforge/axiForgeAdapter";
import {
  buildAxiShape,
  builderFromAxiBuild,
  createEmptyBuilder,
  normalizeBuilderState,
  validateBuilder,
} from "../axiforge/builderModel";
import type { Gw2Skill, Gw2Specialization, Gw2Trait } from "../../types/buildEditor";

function fixtureCatalog() {
  const specializations: Gw2Specialization[] = [4, 36, 18].map((id, index) => ({
    id,
    name: ["Strength", "Discipline", "Berserker"][index],
    profession: "Warrior",
    elite: index === 2,
    major_traits: Array.from({ length: 9 }, (_, traitIndex) => id * 100 + traitIndex + 1),
    minor_traits: [],
  }));
  const traits: Gw2Trait[] = specializations.flatMap((spec) => spec.major_traits.map((id, index) => ({
    id,
    name: `Trait ${id}`,
    specialization: spec.id,
    tier: Math.floor(index / 3) + 1,
    order: index % 3,
    slot: "Major" as const,
  })));
  const skillIds = [14402, 14404, 14410, 14405, 14355];
  const skills: Gw2Skill[] = skillIds.map((id, index) => ({
    id,
    name: `Skill ${id}`,
    slot: index === 0 ? "Heal" : index === 4 ? "Elite" : "Utility",
  }));
  const specsById = new Map(specializations.map((spec) => [spec.id, spec]));
  const traitsBySpecId = new Map(specializations.map((spec) => [spec.id, traits.filter((trait) => trait.specialization === spec.id)]));
  const skillsById = new Map(skills.map((skill) => [skill.id, skill]));
  return { specsById, traitsBySpecId, skillsById };
}

function completeBuild() {
  const state = createEmptyBuilder("Warrior");
  state.name = "Frontline Berserker";
  state.role = "DPS";
  state.specializationIds = [4, 36, 18];
  state.traitChoices = [[1, 2, 3], [3, 2, 1], [2, 2, 2]];
  state.healSkillId = 14402;
  state.utilitySkillIds = [14404, 14410, 14405];
  state.eliteSkillId = 14355;
  state.equipment.statPackage = "Berserker's";
  state.equipment.weapons.mainhand1 = "greatsword";
  state.equipment.weapons.mainhand2 = "axe";
  state.equipment.runes = { head: "24836", shoulders: "24836", chest: "24836", hands: "24836", legs: "24836", feet: "24836" };
  state.equipment.sigils.mainhand1 = ["24615", "24868"];
  state.equipment.relic = "Relic of the Thief";
  state.activeWeaponSet = 2;
  return state;
}

function fullEquipmentBuild() {
  const state = createEmptyBuilder("Guardian");
  state.name = "Fully Geared Firebrand";
  state.role = "Support";
  state.specializationIds = [4, 36, 18];
  state.traitChoices = [[2, 1, 3], [1, 3, 2], [3, 1, 1]];
  state.healSkillId = 14402;
  state.utilitySkillIds = [14404, 14410, 14405];
  state.eliteSkillId = 14355;
  state.equipment.statPackage = "Minstrel's";
  // Note: equipment.slots (trinket item selection, e.g. amulet/ring/accessory/backpack
  // skins) is intentionally left unset here. It is not part of the AxiCode wire format
  // (see the dedicated test below) so it cannot round-trip and is excluded from this
  // fixture to keep this test a true fidelity check of fields the codec supports.
  state.equipment.weapons = {
    mainhand1: "greatsword",
    offhand1: "",
    mainhand2: "sword",
    offhand2: "focus",
    aquatic1: "spear",
    aquatic2: "trident",
  };
  state.equipment.runes = { head: "24836", shoulders: "24714", chest: "24836", hands: "24714", legs: "24836", feet: "24714" };
  state.equipment.sigils = {
    mainhand1: ["24615", "24868"],
    offhand1: [],
    mainhand2: ["24615"],
    offhand2: ["24868"],
    aquatic1: ["24615", "24868"],
    aquatic2: ["24868", "24615"],
  };
  // Note: equipment.infusions is intentionally left unset here. AxiCode only
  // recognizes a narrow "+N Agony Infusion" pattern for infusions (verified against
  // node_modules/@axiapps/code directly) and normalizes even that down to a bare
  // level number on round trip — arbitrary infusion names (stat infusions, WvW
  // infusions, etc.) are silently zeroed. That narrow, format-changing behavior is
  // out of scope for a fidelity test of the fields Entropy's UI actually exposes.
  state.equipment.relic = "Relic of the Herald";
  state.equipment.food = "Bowl of Sweet and Spicy Butternut Squash Soup";
  state.equipment.utility = "Superior Sharpening Stone";
  state.equipment.enrichment = "39330"; // "Experienced Enrichment" id — enrichment is stored/encoded by numeric id, not label
  state.activeWeaponSet = 1;
  return state;
}

function revenantBuild() {
  const state = createEmptyBuilder("Revenant");
  state.name = "Herald Support";
  state.role = "Support";
  state.specializationIds = [4, 36, 18];
  state.traitChoices = [[2, 1, 3], [1, 3, 2], [3, 1, 1]];
  state.healSkillId = 14402;
  state.utilitySkillIds = [14404, 14410, 14405];
  state.eliteSkillId = 14355;
  state.equipment.statPackage = "Minstrel's";
  state.equipment.weapons.mainhand1 = "staff";
  // AxiCode encodes selectedLegends against a fixed vocabulary of "Legend1".."Legend7"
  // (see node_modules/@axiapps/code/src/tables.js) rather than display names — this
  // matches what Entropy's own Builder UI actually stores (legend.id, not the label).
  state.selectedLegends = ["Legend3", "Legend6"];
  return state;
}

function elementalistBuild() {
  const state = createEmptyBuilder("Elementalist");
  state.name = "Fresh Air Weaver";
  state.role = "DPS";
  state.specializationIds = [4, 36, 18];
  state.traitChoices = [[3, 1, 2], [2, 2, 2], [1, 3, 1]];
  state.healSkillId = 14402;
  state.utilitySkillIds = [14404, 14410, 14405];
  state.eliteSkillId = 14355;
  state.equipment.statPackage = "Berserker's";
  state.equipment.weapons.mainhand1 = "sword";
  state.equipment.weapons.offhand1 = "dagger";
  state.activeAttunement = "Fire";
  state.activeAttunement2 = "Water";
  return state;
}

describe("Entropy Builder model", () => {
  it("round-trips traits, skills, equipment, and profession data through AxiCode", () => {
    const state = completeBuild();
    const catalog = fixtureCatalog();
    const code = encodeAxiForgeBuildCode(buildAxiShape(state, catalog.specsById, catalog.traitsBySpecId, catalog.skillsById));
    const decoded = decodeAxiForgeCode(code);

    expect(decoded.ok).toBe(true);
    const restored = builderFromAxiBuild(decoded.value, { name: state.name, role: state.role });
    expect(restored.professionId).toBe("Warrior");
    expect(restored.specializationIds).toEqual([4, 36, 18]);
    expect(restored.traitChoices).toEqual(state.traitChoices);
    expect(restored.utilitySkillIds).toEqual(state.utilitySkillIds);
    expect(restored.equipment.statPackage).toBe("Berserker's");
    expect(restored.equipment.weapons.mainhand1).toBe("greatsword");
    expect(restored.equipment.runes.head).toBe("24836");
    expect(restored.equipment.sigils.mainhand1).toEqual(["24615", "24868"]);
    expect(restored.equipment.relic).toBe("Relic of the Thief");
    expect(restored.activeWeaponSet).toBe(2);
  });

  it("reports no readiness issues for a complete build", () => {
    expect(validateBuilder(completeBuild())).toEqual([]);
  });

  it("migrates the former minimal draft shape without throwing", () => {
    const migrated = normalizeBuilderState({ professionId: "Mesmer", gameMode: "wvw", traitChoices: {}, utilitySkillIds: [null, null, null] });
    expect(migrated.professionId).toBe("Mesmer");
    expect(migrated.traitChoices).toEqual([[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    expect(migrated.equipment.weapons.mainhand1).toBe("");
    expect(migrated.name).toBe("Untitled WvW Build");
  });

  it("round-trips full equipment coverage: trinket slots, all weapon sets, sigils, and infusions", () => {
    const state = fullEquipmentBuild();
    const catalog = fixtureCatalog();
    const code = encodeAxiForgeBuildCode(buildAxiShape(state, catalog.specsById, catalog.traitsBySpecId, catalog.skillsById));
    const decoded = decodeAxiForgeCode(code);
    expect(decoded.ok).toBe(true);
    const restored = builderFromAxiBuild(decoded.value, { name: state.name, role: state.role });

    expect(restored.equipment.weapons).toEqual(state.equipment.weapons);
    expect(restored.equipment.runes).toEqual(state.equipment.runes);
    expect(restored.equipment.sigils).toEqual(state.equipment.sigils);
    expect(restored.equipment.relic).toBe("Relic of the Herald");
    expect(restored.equipment.food).toBe("Bowl of Sweet and Spicy Butternut Squash Soup");
    expect(restored.equipment.utility).toBe("Superior Sharpening Stone");
    expect(restored.equipment.enrichment).toBe("39330");
    expect(restored.activeWeaponSet).toBe(1);
  });

  it("round-trips Revenant legend selection", () => {
    const state = revenantBuild();
    const catalog = fixtureCatalog();
    const code = encodeAxiForgeBuildCode(buildAxiShape(state, catalog.specsById, catalog.traitsBySpecId, catalog.skillsById));
    const decoded = decodeAxiForgeCode(code);
    expect(decoded.ok).toBe(true);
    const restored = builderFromAxiBuild(decoded.value, { name: state.name, role: state.role });
    expect(restored.professionId).toBe("Revenant");
    expect(restored.selectedLegends).toEqual(["Legend3", "Legend6"]);
    expect(restored.equipment.weapons.mainhand1).toBe("staff");
  });

  it("does not preserve equipment.slots (trinket item ids) through AxiCode — known codec limitation", () => {
    // AxiCode's documented equipment shape only carries statPackage, weapons, runes,
    // sigils, relic, food, utility, enrichment, and infusions (see the @axiapps/code
    // README). Trinket item identity (amulet/ring/accessory/backpack skins) has no
    // slot in the wire format and is silently dropped on encode. This test pins that
    // real, confirmed behavior down so a future codec upgrade that starts preserving
    // it (or a regression that starts assuming it round-trips) gets caught here.
    const state = completeBuild();
    state.equipment.slots = { amulet: "berserkers-amulet", ring1: "coalescence" };
    const catalog = fixtureCatalog();
    const code = encodeAxiForgeBuildCode(buildAxiShape(state, catalog.specsById, catalog.traitsBySpecId, catalog.skillsById));
    const decoded = decodeAxiForgeCode(code);
    expect(decoded.ok).toBe(true);
    const restored = builderFromAxiBuild(decoded.value);
    expect(restored.equipment.slots).not.toEqual(state.equipment.slots);
  });

  it("round-trips Elementalist dual attunement state", () => {
    const state = elementalistBuild();
    const catalog = fixtureCatalog();
    const code = encodeAxiForgeBuildCode(buildAxiShape(state, catalog.specsById, catalog.traitsBySpecId, catalog.skillsById));
    const decoded = decodeAxiForgeCode(code);
    expect(decoded.ok).toBe(true);
    const restored = builderFromAxiBuild(decoded.value, { name: state.name, role: state.role });
    expect(restored.professionId).toBe("Elementalist");
    expect(restored.activeAttunement).toBe("Fire");
    expect(restored.activeAttunement2).toBe("Water");
    expect(restored.equipment.weapons.mainhand1).toBe("sword");
    expect(restored.equipment.weapons.offhand1).toBe("dagger");
  });

  it("encodes a squad from referenced build shapes and round-trips each member build", () => {
    const warrior = completeBuild();
    const revenant = revenantBuild();
    const catalog = fixtureCatalog();
    const warriorShape = buildAxiShape(warrior, catalog.specsById, catalog.traitsBySpecId, catalog.skillsById);
    const revenantShape = buildAxiShape(revenant, catalog.specsById, catalog.traitsBySpecId, catalog.skillsById);
    const code = encodeAxiForgeCompCode(
      { name: "Reset Night", gameMode: "wvw", partyLines: [{ capacity: 5, slots: ["frontline", "support"] }] },
      { frontline: warriorShape, support: revenantShape },
    );
    expect(code).not.toBeNull();
    const decoded = decodeAxiForgeCode(code!);
    expect(decoded.ok).toBe(true);
    expect(decoded.kind).toBe("comp");
    const compValue = decoded.value as { name: string; builds: unknown[] };
    expect(compValue.name).toBe("Reset Night");
    expect(compValue.builds).toHaveLength(2);

    const restoredWarrior = builderFromAxiBuild(compValue.builds[0]);
    expect(restoredWarrior.professionId).toBe("Warrior");
    expect(restoredWarrior.specializationIds).toEqual(warrior.specializationIds);
    expect(restoredWarrior.equipment.weapons.mainhand1).toBe("greatsword");
    expect(restoredWarrior.equipment.sigils.mainhand1).toEqual(["24615", "24868"]);

    const restoredRevenant = builderFromAxiBuild(compValue.builds[1]);
    expect(restoredRevenant.professionId).toBe("Revenant");
    expect(restoredRevenant.selectedLegends).toEqual(["Legend3", "Legend6"]);
  });
});
