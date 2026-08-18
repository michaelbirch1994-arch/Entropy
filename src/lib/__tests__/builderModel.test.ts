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

  it("encodes a squad from referenced build shapes", () => {
    const state = completeBuild();
    const catalog = fixtureCatalog();
    const shape = buildAxiShape(state, catalog.specsById, catalog.traitsBySpecId, catalog.skillsById);
    const code = encodeAxiForgeCompCode(
      { name: "Reset Night", gameMode: "wvw", partyLines: [{ capacity: 5, slots: ["frontline"] }] },
      { frontline: shape },
    );
    expect(code).not.toBeNull();
    const decoded = decodeAxiForgeCode(code!);
    expect(decoded.ok).toBe(true);
    expect(decoded.kind).toBe("comp");
    expect((decoded.value as { name: string }).name).toBe("Reset Night");
  });
});
