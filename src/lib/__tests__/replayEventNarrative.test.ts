import { describe, expect, it } from "vitest";
import { buildReplayEventNarrative } from "../replayEventNarrative";
import type { ReplayPreEventChanges, ReplayPreEventMetric } from "../replayPreEventChanges";

function metric(
  key: ReplayPreEventMetric["key"],
  before: number,
  atEvent: number,
  format: ReplayPreEventMetric["format"] = "count",
  coverageBefore = 3,
  coverageAtEvent = 3,
): ReplayPreEventMetric {
  return {
    key,
    label: key,
    before,
    atEvent,
    delta: atEvent - before,
    coverageBefore,
    coverageAtEvent,
    format,
  };
}

function changes(metrics: ReplayPreEventMetric[]): ReplayPreEventChanges {
  return {
    lookbackMs: 5_000,
    beforeTimestampMs: 5_000,
    eventTimestampMs: 10_000,
    metrics,
  };
}

describe("buildReplayEventNarrative", () => {
  it("selects at most two material statements using semantic priority", () => {
    const result = buildReplayEventNarrative(changes([
      metric("nearbyEnemies600", 1, 5, "average"),
      metric("nearbySquad240", 6, 3, "average"),
      metric("stability", 3, 1),
      metric("beyond600FromTag", 0, 2),
      metric("downOrDead", 0, 1),
    ]));

    expect(result?.statements).toHaveLength(2);
    expect(result?.evidenceKeys).toEqual(["downOrDead", "beyond600FromTag"]);
    expect(result?.statements[0].text).toBe("Down/dead participants increased from 0 to 1.");
    expect(result?.statements[1].text).toBe("Participants beyond 600 from tag increased from 0 to 2.");
  });

  it("preserves tracked Stability coverage in the narrative", () => {
    const result = buildReplayEventNarrative(changes([
      metric("stability", 3, 1, "count", 4, 3),
    ]));

    expect(result?.statements[0].text).toBe("Stability presence decreased from 3/4 to 1/3 tracked participants.");
    expect(result?.evidenceKeys).toEqual(["stability"]);
  });

  it("uses the same material thresholds as the evidence display", () => {
    const result = buildReplayEventNarrative(changes([
      metric("beyond600FromTag", 1, 1.4),
      metric("nearbySquad240", 5, 4.6, "average"),
    ]));

    expect(result?.statements).toEqual([]);
    expect(result?.evidenceKeys).toEqual([]);
    expect(result?.fallback).toContain("No material tracked state changes");
  });

  it("distinguishes missing comparable evidence from a quiet window", () => {
    const result = buildReplayEventNarrative(changes([]));
    expect(result?.statements).toEqual([]);
    expect(result?.fallback).toBe("No comparable tracked state was available at both endpoints.");
  });

  it("returns null when there is no pre-event change state", () => {
    expect(buildReplayEventNarrative(null)).toBeNull();
  });
});
