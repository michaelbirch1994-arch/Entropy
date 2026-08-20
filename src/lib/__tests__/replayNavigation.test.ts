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
      worldSpace: { mapId: null, wvwMapData: null },
      skillMeta: {},
      mechanics: [],
    },
  };
}

function target(overrides: Partial<ViewNavigationTarget> = {}): ViewNavigationTarget {
  return { source: "intelligence", targetView: "fight-replay", fightIndex: 1, timestampMs: 12_345, account: "Player.1234", eventId: "critical-7", metric: "Squad separation", ...overrides };
}

describe("resolveReplayNavigationTarget", () => {
  const fights = [replayFight("fight-a", 10_000), replayFight("fight-b", 30_000)];

  it("preserves an exact valid Intelligence fight and millisecond target", () => {
    expect(resolveReplayNavigationTarget(fights, target())).toEqual({
      fightIndex: 1,
      fightId: "fight-b",
      timestampMs: 12_345,
      account: "Player.1234",
      eventId: "critical-7",
      metric: "Squad separation",
      source: "intelligence",
    });
  });

  it("prefers stable fight identity when a filtered Replay array no longer matches source indexes", () => {
    const resolved = resolveReplayNavigationTarget(fights, target({ source: "other", fightId: "fight-a", fightIndex: 1 }));
    expect(resolved?.fightIndex).toBe(0);
    expect(resolved?.fightId).toBe("fight-a");
    expect(resolved?.source).toBe("other");
  });

  it("clamps timestamps to the selected replay fight duration", () => {
    expect(resolveReplayNavigationTarget(fights, target({ timestampMs: 99_000 }))?.timestampMs).toBe(30_000);
    expect(resolveReplayNavigationTarget(fights, target({ timestampMs: -500 }))?.timestampMs).toBe(0);
  });

  it("rejects missing or invalid fight identity instead of silently choosing another fight", () => {
    expect(resolveReplayNavigationTarget(fights, target({ fightIndex: 2 }))).toBeNull();
    expect(resolveReplayNavigationTarget(fights, target({ fightIndex: -1 }))).toBeNull();
    expect(resolveReplayNavigationTarget(fights, target({ fightIndex: undefined }))).toBeNull();
    expect(resolveReplayNavigationTarget(fights, target({ fightId: "missing-fight" }))).toBeNull();
  });

  it("ignores navigation intended for another view while accepting exact evidence from other views", () => {
    expect(resolveReplayNavigationTarget(fights, target({ targetView: "death-recap" }))).toBeNull();
    expect(resolveReplayNavigationTarget(fights, target({ source: "overview" }))?.source).toBe("overview");
  });

  it("accepts an exact zero-millisecond anchor", () => {
    expect(resolveReplayNavigationTarget(fights, target({ fightIndex: 0, timestampMs: 0 }))?.timestampMs).toBe(0);
  });

  it("rejects a target without a persisted timestamp", () => {
    expect(resolveReplayNavigationTarget(fights, target({ timestampMs: undefined }))).toBeNull();
  });
});
