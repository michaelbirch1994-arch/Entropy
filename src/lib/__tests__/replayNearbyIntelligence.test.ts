import { describe, expect, it } from "vitest";
import { alignedReplayIntelligenceEvent, nearbyReplayIntelligenceEvents } from "../replayNearbyIntelligence";
import type { ReplayIntelligenceAnchor } from "../replayIntelligenceAnchors";

function anchor(id: string, fightIndex: number, timestampMs: number): ReplayIntelligenceAnchor {
  return {
    id,
    fightId: `fight-${fightIndex}`,
    fightIndex,
    fightName: `Fight ${fightIndex + 1}`,
    timestampMs,
    kind: "death-cluster",
    category: "defense",
    summary: id,
    confidence: "high",
    accounts: [],
  };
}

describe("nearbyReplayIntelligenceEvents", () => {
  const anchors = [
    anchor("past", 0, 8_000),
    anchor("nearest", 0, 10_500),
    anchor("future", 0, 14_000),
    anchor("other-fight", 1, 10_200),
    anchor("outside", 0, 20_000),
  ];

  it("returns only same-fight events inside the symmetric playhead window", () => {
    expect(nearbyReplayIntelligenceEvents(anchors, 0, 10_000, 5_000).map((event) => event.id)).toEqual([
      "nearest",
      "past",
      "future",
    ]);
  });

  it("reports signed offsets and sorts by distance from the playhead", () => {
    const events = nearbyReplayIntelligenceEvents(anchors, 0, 10_000, 5_000);
    expect(events.map((event) => [event.id, event.offsetMs, event.distanceMs])).toEqual([
      ["nearest", 500, 500],
      ["past", -2_000, 2_000],
      ["future", 4_000, 4_000],
    ]);
  });

  it("returns the nearest aligned event only inside the exact tolerance", () => {
    expect(alignedReplayIntelligenceEvent(anchors, 0, 10_000)?.id).toBe("nearest");
    expect(alignedReplayIntelligenceEvent(anchors, 0, 9_000)).toBeNull();
    expect(alignedReplayIntelligenceEvent(anchors, 1, 10_000)?.id).toBe("other-fight");
  });

  it("rejects invalid playhead/window input instead of manufacturing context", () => {
    expect(nearbyReplayIntelligenceEvents(anchors, 0, Number.NaN, 5_000)).toEqual([]);
    expect(nearbyReplayIntelligenceEvents(anchors, 0, 10_000, -1)).toEqual([]);
    expect(alignedReplayIntelligenceEvent(anchors, 0, 10_000, Number.NaN)).toBeNull();
    expect(alignedReplayIntelligenceEvent(anchors, 0, 10_000, -1)).toBeNull();
  });
});
