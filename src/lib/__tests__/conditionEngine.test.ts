import { describe, expect, it } from "vitest";
import { analyzeBuildConditions, fallbackConditionIcon } from "../axiforge/conditionEngine";
import type { Gw2Skill, Gw2Trait } from "../../types/buildEditor";

function skill(partial: Partial<Gw2Skill>): Gw2Skill {
  return {
    id: partial.id ?? 1,
    name: partial.name ?? "Skill",
    slot: partial.slot ?? "Utility",
    ...partial,
  };
}

function trait(partial: Partial<Gw2Trait>): Gw2Trait {
  return {
    id: partial.id ?? 10,
    name: partial.name ?? "Trait",
    specialization: partial.specialization ?? 1,
    tier: partial.tier ?? 1,
    order: partial.order ?? 1,
    slot: partial.slot ?? "Major",
    ...partial,
  };
}

describe("Builder condition access", () => {
  it("detects condition facts and condition text from selected skills and traits", () => {
    const result = analyzeBuildConditions(
      [
        skill({
          name: "Ashen Burst",
          facts: [{ type: "Buff", status: "Burning", duration: 3, apply_count: 2, icon: "burn.png" }],
        }),
        skill({
          name: "Venom Edge",
          description: "Strike your target and inflict poison.",
        }),
      ],
      [
        trait({
          name: "Lockdown",
          description: "Disabling a foe applies vulnerability and weakness.",
        }),
      ],
    );

    expect(result.map((entry) => entry.name)).toEqual(["Burning", "Poison", "Vulnerability", "Weakness"]);
    expect(result[0].sources[0]).toMatchObject({ sourceName: "Ashen Burst", stacks: 2, duration: 3 });
    expect(result.find((entry) => entry.name === "Poison")?.sources[0].type).toBe("skill");
    expect(result.find((entry) => entry.name === "Weakness")?.sources[0].type).toBe("trait");
  });

  it("provides fallback icons for core condition names", () => {
    expect(fallbackConditionIcon("Bleeding")).toContain("Bleeding");
    expect(fallbackConditionIcon("Taunt")).toContain("Taunt");
  });
});
