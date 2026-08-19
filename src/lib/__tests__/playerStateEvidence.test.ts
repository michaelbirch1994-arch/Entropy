import { describe, expect, it } from "vitest";
import type { RawFightLog } from "../../types/rawFight";
import { buildIntelligencePlayerStateEvidence } from "../intelligence/playerStateEvidence";

const log = {
  durationMS: 10_000,
  buffMap: {
    b1122: { name: "Stability", classification: "Boon", stacking: true },
    b725: { name: "Might", classification: "Boon", stacking: true },
    b791: { name: "Fear", classification: "Condition", stacking: false },
  },
  players: [
    {
      account: "Tester.1234",
      name: "Test Guardian",
      profession: "Guardian",
      buffUptimes: [
        { id: 1122, states: [[0, 0], [1000, 2], [4000, 0]] },
        { id: 725, states: [[0, 5], [3000, 10], [7000, 0]] },
        { id: 791, states: [[0, 0], [2500, 1], [3500, 0]] },
      ],
    },
  ],
} as unknown as RawFightLog;

describe("buildIntelligencePlayerStateEvidence", () => {
  it("reuses Replay inspection for exact-time boons and conditions", () => {
    const evidence = buildIntelligencePlayerStateEvidence({ log, account: "Tester.1234", timestampMs: 3000 });

    expect(evidence?.boons.map((effect) => [effect.name, effect.stacks])).toEqual([
      ["Might", 10],
      ["Stability", 2],
    ]);
    expect(evidence?.conditions.map((effect) => effect.name)).toEqual(["Fear"]);
    expect(evidence?.controlEffects).toEqual(["Fear"]);
    expect(evidence?.controlStatus).toBe("known-control-effect");
  });

  it("does not turn absent condition-backed control into proof of no hard CC", () => {
    const evidence = buildIntelligencePlayerStateEvidence({ log, account: "Tester.1234", timestampMs: 8000 });

    expect(evidence?.conditions).toEqual([]);
    expect(evidence?.controlEffects).toEqual([]);
    expect(evidence?.controlStatus).toBe("no-condition-control-observed");
  });

  it("marks timestamp state unavailable when EI state timelines are absent", () => {
    const archived = {
      ...log,
      players: [{ account: "Tester.1234", name: "Test Guardian", profession: "Guardian", buffUptimes: [{ id: 1122, buffData: [{ uptime: 90 }] }] }],
    } as unknown as RawFightLog;

    const evidence = buildIntelligencePlayerStateEvidence({ log: archived, account: "Tester.1234", timestampMs: 2000 });
    expect(evidence?.hasTimestampedBuffState).toBe(false);
    expect(evidence?.controlStatus).toBe("timestamp-state-unavailable");
    expect(evidence?.boons).toEqual([]);
  });

  it("returns null when the requested account is not present", () => {
    expect(buildIntelligencePlayerStateEvidence({ log, account: "Missing.9999", timestampMs: 3000 })).toBeNull();
  });
});
