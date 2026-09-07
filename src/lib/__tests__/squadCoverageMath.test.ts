import { describe, expect, it } from "vitest";
import type { BuilderParty } from "../../types/buildEditor";
import { estimateSquadBoonUptime } from "../axiforge/squadCoverageMath";

const parties: BuilderParty[] = [
  { id: "one", name: "Subgroup 1", slots: ["a", "b", "c", "d", "e"] },
  { id: "two", name: "Subgroup 2", slots: ["f", "g", "h", null, null] },
];

describe("squad coverage math", () => {
  it("stacks providers within a subgroup and weights subgroups by assigned members", () => {
    expect(estimateSquadBoonUptime(parties, [
      { partyId: "one", estimatedUptimePercent: 20 },
      { partyId: "one", estimatedUptimePercent: 20 },
      { partyId: "two", estimatedUptimePercent: 10 },
    ])).toBeCloseTo(28.75);
  });

  it("does not add identical coverage from different subgroups", () => {
    expect(estimateSquadBoonUptime(parties, [
      { partyId: "one", estimatedUptimePercent: 15 },
      { partyId: "two", estimatedUptimePercent: 15 },
    ])).toBe(15);
  });

  it("caps subgroup uptime and returns unknown when no timed source exists", () => {
    expect(estimateSquadBoonUptime(parties, [
      { partyId: "one", estimatedUptimePercent: 70 },
      { partyId: "one", estimatedUptimePercent: 60 },
    ])).toBe(62.5);
    expect(estimateSquadBoonUptime(parties, [{ partyId: "one" }])).toBeUndefined();
  });
});

