import { describe, expect, it } from "vitest";
import { quantizeReplayAnalysisTime, resolveReplayPlaybackTime } from "../replayPlaybackClock";

describe("resolveReplayPlaybackTime", () => {
  it("derives time from one monotonic anchor without accumulating frame deltas", () => {
    const anchor = { timelineMs: 1_000, wallClockMs: 10_000 };
    expect(resolveReplayPlaybackTime(anchor, 10_500, 1, 20_000)).toBe(1_500);
    expect(resolveReplayPlaybackTime(anchor, 12_000, 2, 20_000)).toBe(5_000);
  });

  it("loops deterministically at the fight duration", () => {
    const anchor = { timelineMs: 9_500, wallClockMs: 2_000 };
    expect(resolveReplayPlaybackTime(anchor, 3_000, 1, 10_000)).toBe(500);
  });

  it("guards invalid duration and speed inputs", () => {
    const anchor = { timelineMs: 500, wallClockMs: 0 };
    expect(resolveReplayPlaybackTime(anchor, 500, 0, 2_000)).toBe(1_000);
    expect(resolveReplayPlaybackTime(anchor, 500, 1, 0)).toBe(0);
  });
});

describe("quantizeReplayAnalysisTime", () => {
  it("keeps analysis updates bounded while preserving sub-second alignment", () => {
    expect(quantizeReplayAnalysisTime(1_249, 200)).toBe(1_200);
    expect(quantizeReplayAnalysisTime(1_400, 200)).toBe(1_400);
  });
});
