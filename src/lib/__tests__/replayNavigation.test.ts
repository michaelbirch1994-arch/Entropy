import { describe, expect, it } from "vitest";
import type { ReplayFightEntry } from "../../types/report";
import type { ViewNavigationTarget } from "../../store/ViewContext";
import { resolveReplayNavigationTarget } from "../replayNavigation";

function replayFight(id: string, durationMs: number): ReplayFightEntry {
  return {
    fightId: id,
    fightName: id,
    data: {
      durationMs,
      bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
      players: [],
      enemies: [],
      map: null,
      skillMeta: {},
      mechanics: [],
    },
  };
}

function target(overrides: Partial<ViewNavigationTarget> = {}): ViewNavigationTarget {
  return {
    source: "intelligence",
    targetView: "fight-replay",
    fightIndex: 1,
    timestampMs: 12_345,
    account: "Player.1234",
    eventId: "critical-7",
    ...overrides,
  };
}

describe("resolveReplayNavigationTarget", () => {
  const fights = [replayFight("fight-a", 10_000), replayFight("fight-b", 30_000)];

  it("preserves an exact valid Intelligence fight and millisecond target", () => {
    expect(resolveReplayNavigationTarget(fights, target())).toEqual({
      fightIndex: 1,
      timestampMs: 12_345,
      account: "Player.1234",
      eventId: "critical-7",
    });
  });

  it("clamps timestamps to the selected replay fight duration", () => {
    expect(resolveReplayNavigationTarget(fights, target({ timestampMs: 99_000 }))?.timestampMs).toBe(30_000);
    expect(resolveReplayNavigationTarget(fights, target({ timestampMs: -500 }))?.timestampMs).toBe(0);
  });

  it("rejects missing or invalid fight identity instead of silently choosing another fight", () => {
    expect(resolveReplayNavigationTarget(fights, target({ fightIndex: 2 }))).toBeNull();
    expect(resolveReplayNavigationTarget(fights, target({ fightIndex: -1 }))).toBeNull();
    expect(resolveReplayNavigationTarget(fights, target({ fightIndex: undefined }))).toBeNull();
  });

  it("ignores navigation intended for another view or source", () => {
    expect(resolveReplayNavigationTarget(fights, target({ targetView: "death-recap" }))).toBeNull();
    expect(resolveReplayNavigationTarget(fights, target({ source: "overview" }))).toBeNull();
  });

  it("accepts an exact zero-millisecond anchor", () => {
    expect(resolveReplayNavigationTarget(fights, target({ fightIndex: 0, timestampMs: 0 }))?.timestampMs).toBe(0);
  });
});
