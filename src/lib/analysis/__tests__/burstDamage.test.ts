import { describe, expect, it } from "vitest";
import { peakOneSecondDamage } from "../burstDamage";

const peak = (points: readonly number[], durationMs = (points.length - 1) * 1000) =>
  peakOneSecondDamage({ points, durationMs, scope: "all-targets" });

describe("peakOneSecondDamage", () => {
  it("measures the user's example, not fight-average DPS", () => {
    // Per-second damage: 8,000, 113,174, 12,000.
    expect(peak([0, 8000, 121174, 133174])).toEqual({
      status: "available", definition: "log-aligned-1s-v1", scope: "all-targets",
      damage: 113174, startMs: 1000, endMs: 2000, intervals: 3,
    });
  });

  it("retains the earliest tied peak", () => {
    expect(peak([0, 500, 1000])).toMatchObject({ damage: 500, startMs: 0, endMs: 1000 });
  });

  it("recognizes a valid zero-damage fight", () => {
    expect(peak([0, 0, 0])).toMatchObject({ status: "available", damage: 0 });
  });

  it("includes the final complete interval", () => {
    expect(peak([0, 10, 110])).toMatchObject({ damage: 100, endMs: 2000 });
  });

  it("excludes a final partial second even if it has more damage", () => {
    expect(peak([0, 10, 110, 10110], 2250)).toMatchObject({ damage: 100, endMs: 2000 });
  });

  it("does not claim a complete second for a short fight", () => {
    expect(peak([0, 1000], 250)).toEqual({ status: "unavailable", reason: "no-full-second" });
  });

  it.each([0, -1, NaN, Infinity, 1000.5])("rejects invalid duration %s", duration => {
    expect(peak([0, 10], duration)).toEqual({ status: "unavailable", reason: "invalid-duration" });
  });

  it.each([[0], [0, 10], [0, 10, 20, 30]])("rejects wrong sample count %j", (...points) => {
    expect(peak(points, 2000)).toEqual({ status: "unavailable", reason: "incomplete-series" });
  });

  it.each([
    [0, NaN, 100], [0, Infinity, 100], [0, -1, 100], [0, 100, 50],
    [1, 100, 200], [0, 1.5, 100], [0, 100, Number.MAX_SAFE_INTEGER + 1],
  ])("rejects malformed or reset samples %j", (...points) => {
    expect(peak(points)).toEqual({ status: "unavailable", reason: "invalid-series" });
  });

  it("rejects sparse samples", () => {
    const points = [0, 10, 20];
    delete points[1];
    expect(peak(points)).toEqual({ status: "unavailable", reason: "invalid-series" });
  });

  it("preserves input and caller-established scope", () => {
    const points = Object.freeze([0, 5, 15]);
    expect(peakOneSecondDamage({ points, durationMs: 2000, scope: "enemy-players" }))
      .toMatchObject({ scope: "enemy-players", damage: 10 });
    expect(points).toEqual([0, 5, 15]);
  });
});
