import { describe, expect, it } from "vitest";
import type { Gw2Skill, Gw2Trait } from "../../types/buildEditor";
import { analyzeBuildUtility } from "../axiforge/utilityEngine";

describe("builder utility coverage", () => {
  it("detects structured cleanse, boon removal, healing, and projectile defense facts", () => {
    const skill = {
      id: 1,
      name: "Utility Field",
      slot: "Utility",
      description: "Create an area around allies that blocks missiles.",
      facts: [
        { type: "Number", text: "Conditions Removed", value: 1 },
        { type: "Number", text: "Boons Removed", value: 1 },
        { type: "AttributeAdjust", text: "Healing", value: 500 },
        { type: "NoData", text: "Blocks Missiles" },
        { type: "Recharge", text: "Recharge", value: 20 },
      ],
    } as Gw2Skill;

    const coverage = analyzeBuildUtility([skill], []);
    expect(coverage.map(({ kind }) => kind)).toEqual(["cleanse", "boonRemoval", "healing", "projectileDefense"]);
    expect(coverage.every((entry) => entry.sources[0].recharge === 20)).toBe(true);
  });

  it("detects description-based stun breaks, reflects, crowd control, and revival", () => {
    const skill = {
      id: 2,
      name: "Rescue Wall",
      slot: "Utility",
      description: "Break stuns for allies, reflect projectiles, pull foes, and revive nearby allies.",
      facts: [],
    } as Gw2Skill;
    expect(analyzeBuildUtility([skill], []).map(({ kind }) => kind)).toEqual([
      "stunBreak", "reflect", "crowdControl", "revive",
    ]);
  });

  it("does not mistake a defensive stun break for offensive crowd control", () => {
    const skill = {
      id: 4,
      name: "Stand Together",
      slot: "Utility",
      description: "Break stuns for nearby allies and grant stability.",
    } as Gw2Skill;
    expect(analyzeBuildUtility([skill], []).map(({ kind }) => kind)).toEqual(["stunBreak"]);
  });

  it("recognizes ArenaNet's gerund wording for projectile destruction", () => {
    const skill = {
      id: 5,
      name: "Death's Charge",
      slot: "Profession",
      description: "Slide forward, destroying projectiles in your path.",
    } as Gw2Skill;
    expect(analyzeBuildUtility([skill], []).map(({ kind }) => kind)).toEqual(["projectileDefense"]);
  });

  it("deduplicates trait sources and recognizes barrier, stealth, and superspeed", () => {
    const trait = {
      id: 3,
      name: "Hidden Momentum",
      specialization: 1,
      tier: 1,
      order: 1,
      slot: "Major",
      facts: [
        { type: "Buff", status: "Barrier" },
        { type: "Buff", status: "Stealth" },
        { type: "Buff", status: "Superspeed" },
      ],
    } as Gw2Trait;
    const coverage = analyzeBuildUtility([], [trait, trait]);
    expect(coverage.map(({ kind }) => kind)).toEqual(["barrier", "stealth", "superspeed"]);
    expect(coverage.every((entry) => entry.sources.length === 1)).toBe(true);
  });
});
