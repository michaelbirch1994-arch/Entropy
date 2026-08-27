import { describe, expect, it } from "vitest";
import type { AttributeProfile } from "../gw2/computeAttributes";
import { createComposition, createEmptyBuilder, createSavedBuild } from "../axiforge/builderModel";
import { computeSquadTacticalReadout } from "../axiforge/squadTactics";

function profile(primaryIdentity: AttributeProfile["primaryIdentity"], score: number): AttributeProfile {
  return {
    totals: {
      power: 0,
      precision: 0,
      toughness: 0,
      vitality: 0,
      concentration: 0,
      conditionDamage: 0,
      expertise: 0,
      ferocity: 0,
      healingPower: 0,
      health: 0,
      critChance: 0,
      critDamage: 0,
      boonDuration: 0,
      conditionDuration: 0,
    },
    contributions: [],
    equippedSlots: 14,
    totalSlots: 14,
    activeWeaponSet: 1,
    primaryIdentity,
    pressure: {
      strike: primaryIdentity === "strike" ? score : 10,
      condition: primaryIdentity === "condition" ? score : 10,
      support: primaryIdentity === "support" ? score : 10,
      sustain: primaryIdentity === "sustain" ? score : 10,
    },
  };
}

function savedBuild(name: string, professionId: string) {
  const state = createEmptyBuilder(professionId);
  state.name = name;
  return createSavedBuild(state, "AxiCode");
}

describe("Builder squad tactical readout", () => {
  it("summarizes assigned pressure identities, averages, open slots, and top builds", () => {
    const strike = savedBuild("Hammer Train", "Warrior");
    const support = savedBuild("Stab Anchor", "Guardian");
    const sustain = savedBuild("Water Pocket", "Elementalist");
    const composition = createComposition("Reset Night");
    composition.parties = [
      { id: "party-1", name: "Subgroup 1", slots: [strike.id, support.id, null, null, null] },
      { id: "party-2", name: "Subgroup 2", slots: [sustain.id, null, null, null, null] },
    ];

    const profiles = new Map([
      [strike.id, profile("strike", 88)],
      [support.id, profile("support", 76)],
      [sustain.id, profile("sustain", 70)],
    ]);
    const readout = computeSquadTacticalReadout(composition, [strike, support, sustain], (build) => profiles.get(build.id)!);

    expect(readout.assignedSlots).toBe(3);
    expect(readout.capacity).toBe(10);
    expect(readout.openSlots).toBe(7);
    expect(readout.identityCounts).toEqual({ strike: 1, condition: 0, support: 1, sustain: 1 });
    expect(readout.averagePressure).toEqual({ strike: 36, condition: 10, support: 32, sustain: 30 });
    expect(readout.topBuilds.map((build) => build.name)).toEqual(["Hammer Train", "Stab Anchor", "Water Pocket"]);
  });

  it("ignores stale squad slot ids that no longer have saved builds", () => {
    const build = savedBuild("Cleanse Core", "Tempest");
    const composition = createComposition("Archive");
    composition.parties = [{ id: "party-1", name: "Subgroup 1", slots: [build.id, "deleted-build", null, null, null] }];

    const readout = computeSquadTacticalReadout(composition, [build], () => profile("support", 60));

    expect(readout.assignedSlots).toBe(1);
    expect(readout.capacity).toBe(5);
    expect(readout.openSlots).toBe(4);
    expect(readout.identityCounts.support).toBe(1);
  });
});