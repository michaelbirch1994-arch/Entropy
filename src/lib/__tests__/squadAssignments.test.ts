import { describe, expect, it } from "vitest";
import { moveSquadAssignment } from "../axiforge/squadAssignments";
import type { BuilderParty } from "../../types/buildEditor";

const parties: BuilderParty[] = [
  { id: "party-1", name: "Subgroup 1", slots: ["support", "damage", null] },
  { id: "party-2", name: "Subgroup 2", slots: ["control", null, null] },
];

describe("moveSquadAssignment", () => {
  it("moves an assignment into an empty slot without changing the build id", () => {
    const moved = moveSquadAssignment(parties, { partyId: "party-1", slotIndex: 0 }, { partyId: "party-2", slotIndex: 1 });

    expect(moved[0].slots).toEqual([null, "damage", null]);
    expect(moved[1].slots).toEqual(["control", "support", null]);
  });

  it("swaps assignments when the destination is occupied", () => {
    const moved = moveSquadAssignment(parties, { partyId: "party-1", slotIndex: 1 }, { partyId: "party-2", slotIndex: 0 });

    expect(moved[0].slots).toEqual(["support", "control", null]);
    expect(moved[1].slots).toEqual(["damage", null, null]);
  });

  it("leaves the composition untouched for an invalid source", () => {
    expect(moveSquadAssignment(parties, { partyId: "missing", slotIndex: 0 }, { partyId: "party-2", slotIndex: 1 })).toBe(parties);
  });
});
