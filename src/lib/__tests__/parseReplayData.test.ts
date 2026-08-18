import { describe, expect, it } from 'vitest';
import {
  distanceBetween,
  interpolateFacing,
  interpolatePosition,
  isInInterval,
  type ReplayFacingPoint,
  type ReplayPoint,
} from '../parseReplayData';

// Regression coverage for the replay-scrubbing primitives behind Fight
// Replay's dot/line rendering. This file exists because the actual bug
// class that repeatedly shipped as "trailing line" / "streak" reports
// (v0.2.36, v0.2.40, v0.2.42, v0.2.43, v0.2.44) was never in these
// functions - it was SVG paint compositing and an unverified facing-angle
// convention - but that took several releases to pin down precisely
// because there was no test coverage isolating "is the interpolation math
// itself correct" from "does it render correctly on screen". These tests
// lock down the math so any future regression here is caught in CI before
// it reaches a release.

describe('interpolatePosition', () => {
  const points: ReplayPoint[] = [
    { t: 0, x: 0, y: 0 },
    { t: 1000, x: 100, y: 0 },
    { t: 2000, x: 100, y: 100 },
  ];

  it('returns null for an empty track', () => {
    expect(interpolatePosition([], 500)).toBeNull();
  });

  it('clamps to the first point before the track starts', () => {
    expect(interpolatePosition(points, -500)).toEqual(points[0]);
  });

  it('clamps to the last point after the track ends', () => {
    expect(interpolatePosition(points, 5000)).toEqual(points[2]);
  });

  it('returns the exact sample when t lands on a sample', () => {
    expect(interpolatePosition(points, 1000)).toEqual(points[1]);
  });

  it('linearly interpolates between two samples', () => {
    const mid = interpolatePosition(points, 500);
    expect(mid).not.toBeNull();
    expect(mid!.x).toBeCloseTo(50);
    expect(mid!.y).toBeCloseTo(0);
  });

  it('does not overshoot or lag behind consecutive scrub steps (no trailing artifact)', () => {
    // A "trailing line" bug looks like the interpolated point lagging
    // behind where it should be as t increases monotonically. Walking t
    // forward in small steps should produce monotonically increasing x
    // across the first segment, with no backward jumps.
    let prevX = -Infinity;
    for (let t = 0; t <= 1000; t += 50) {
      const p = interpolatePosition(points, t)!;
      expect(p.x).toBeGreaterThanOrEqual(prevX);
      prevX = p.x;
    }
  });
});

describe('interpolateFacing', () => {
  it('returns null for an empty track', () => {
    expect(interpolateFacing([], 500)).toBeNull();
  });

  it('clamps to the first/last angle outside the track range', () => {
    const facings: ReplayFacingPoint[] = [
      { t: 0, angle: 10 },
      { t: 1000, angle: 20 },
    ];
    expect(interpolateFacing(facings, -100)).toBe(10);
    expect(interpolateFacing(facings, 5000)).toBe(20);
  });

  it('linearly interpolates a normal (non-wrapping) angle change', () => {
    const facings: ReplayFacingPoint[] = [
      { t: 0, angle: 0 },
      { t: 1000, angle: 90 },
    ];
    expect(interpolateFacing(facings, 500)).toBeCloseTo(45);
  });

  it('takes the short way across the 0/360 wrap instead of the long way', () => {
    // 350deg -> 10deg is a 20deg turn the short way (through 0/360), not a
    // 340deg turn the long way through 180. A plain linear lerp gets this
    // wrong and would produce ~180 at the midpoint instead of ~0.
    const facings: ReplayFacingPoint[] = [
      { t: 0, angle: 350 },
      { t: 1000, angle: 10 },
    ];
    const mid = interpolateFacing(facings, 500)!;
    // Normalize to 0-360 for comparison since the raw result can be
    // slightly negative (e.g. -0.0001) depending on rounding.
    const normalized = ((mid % 360) + 360) % 360;
    expect(normalized).toBeCloseTo(0, 0);
    expect(normalized).not.toBeCloseTo(180, 0);
  });

  it('takes the short way across the wrap in the other direction', () => {
    const facings: ReplayFacingPoint[] = [
      { t: 0, angle: 10 },
      { t: 1000, angle: 350 },
    ];
    const mid = interpolateFacing(facings, 500)!;
    const normalized = ((mid % 360) + 360) % 360;
    expect(normalized).toBeCloseTo(0, 0);
  });
});

describe('isInInterval', () => {
  it('is false for an empty interval list', () => {
    expect(isInInterval([], 500)).toBe(false);
  });

  it('is true when t falls inside an interval (inclusive bounds)', () => {
    const intervals: [number, number][] = [[100, 200]];
    expect(isInInterval(intervals, 100)).toBe(true);
    expect(isInInterval(intervals, 150)).toBe(true);
    expect(isInInterval(intervals, 200)).toBe(true);
  });

  it('is false just outside an interval', () => {
    const intervals: [number, number][] = [[100, 200]];
    expect(isInInterval(intervals, 99)).toBe(false);
    expect(isInInterval(intervals, 201)).toBe(false);
  });

  it('checks across multiple disjoint intervals (down/dead toggling)', () => {
    const intervals: [number, number][] = [[100, 200], [500, 600]];
    expect(isInInterval(intervals, 550)).toBe(true);
    expect(isInInterval(intervals, 300)).toBe(false);
  });
});

describe('distanceBetween', () => {
  it('returns null if either point is null', () => {
    expect(distanceBetween(null, { t: 0, x: 0, y: 0 })).toBeNull();
    expect(distanceBetween({ t: 0, x: 0, y: 0 }, null)).toBeNull();
  });

  it('computes straight-line distance', () => {
    expect(distanceBetween({ t: 0, x: 0, y: 0 }, { t: 0, x: 3, y: 4 })).toBe(5);
  });
});
