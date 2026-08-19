import { describe, expect, it } from "vitest";
import { inspectReplayPlayer } from "../replayInspection";
import type { RawFightLog } from "../../types/rawFight";

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

describe("Fight Replay player inspection", () => {
  it("uses the last state change at or before the selected timestamp", () => {
    const inspection = inspectReplayPlayer(log, "Tester.1234", 2000);
    expect(inspection?.boons.map((effect) => [effect.name, effect.stacks])).toEqual([
      ["Might", 5],
      ["Stability", 2],
    ]);
    expect(inspection?.conditions).toEqual([]);
  });

  it("handles exact state boundaries and condition-based control", () => {
    const inspection = inspectReplayPlayer(log, "Tester.1234", 3000);
    expect(inspection?.boons.find((effect) => effect.name === "Might")?.stacks).toBe(10);
    expect(inspection?.conditions.map((effect) => effect.name)).toContain("Fear");
    expect(inspection?.controlEffects).toEqual(["Fear"]);
    expect(inspection?.hardCcKnown).toBe(true);
  });

  it("removes effects after their zero-state transition", () => {
    const inspection = inspectReplayPlayer(log, "Tester.1234", 8000);
    expect(inspection?.boons).toEqual([]);
    expect(inspection?.conditions).toEqual([]);
    expect(inspection?.hardCcKnown).toBe(false);
  });

  it("reports timestamp state as unavailable when states are not persisted", () => {
    const archived = {
      ...log,
      players: [{ account: "Tester.1234", name: "Test Guardian", profession: "Guardian", buffUptimes: [{ id: 1122, buffData: [{ uptime: 90 }] }] }],
    } as unknown as RawFightLog;
    const inspection = inspectReplayPlayer(archived, "Tester.1234", 2000);
    expect(inspection?.hasTimestampedBuffState).toBe(false);
    expect(inspection?.boons).toEqual([]);
  });
});
