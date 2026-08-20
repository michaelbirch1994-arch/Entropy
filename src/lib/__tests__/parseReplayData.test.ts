import { describe, expect, it } from 'vitest';
import {
  distanceBetween,
  interpolateFacing,
  interpolatePosition,
  isInInterval,
  parseReplayData,
  type ReplayFacingPoint,
  type ReplayPoint,
} from '../parseReplayData';
import type { RawFightLog } from '../../types/rawFight';

// Regression coverage for the replay-scrubbing primitives behind Fight
// Replay's dot/line rendering. Trail reports have had several independent
// causes: SVG paint/facing behavior, non-unique target identities, and
// interpolation across implausible spatial jumps. These tests isolate the
// data/math layer so future regressions are caught before release.

describe('interpolatePosition', () => {
  const points: ReplayPoint[] = [
    { t: 0, x: 0, y: 0 },
    { t: 1000, x: 100, y: 0 },
    { t: 2000, x: 100, y: 100 },
  ];

  it('returns null for an empty track', () => {
    expect(interpolatePosition([], 500)).toBeNull();
  });

  it('does not pin an actor to its first point before EI starts tracking it', () => {
    expect(interpolatePosition(points, -500)).toBeNull();
  });

  it('does not leave a stationary ghost after EI stops tracking the actor', () => {
    expect(interpolatePosition(points, 5000)).toBeNull();
  });

  it('returns both exact edge samples while the track is valid', () => {
    expect(interpolatePosition(points, 0)).toEqual(points[0]);
    expect(interpolatePosition(points, 2000)).toEqual(points[2]);
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
    let prevX = -Infinity;
    for (let t = 0; t <= 1000; t += 50) {
      const p = interpolatePosition(points, t)!;
      expect(p.x).toBeGreaterThanOrEqual(prevX);
      prevX = p.x;
    }
  });

  it('does not interpolate an impossible spatial jump between adjacent samples', () => {
    const jumped: ReplayPoint[] = [
      { t: 0, x: 0, y: 0 },
      { t: 150, x: 5000, y: 5000 },
    ];

    expect(interpolatePosition(jumped, 75)).toBeNull();
    expect(interpolatePosition(jumped, 0)).toEqual(jumped[0]);
    expect(interpolatePosition(jumped, 150)).toEqual(jumped[1]);
  });
});

describe('parseReplayData enemy identity', () => {
  it('uses the EI instance id when several enemies share one species id', () => {
    const actorReplay = {
      start: 0,
      positions: [[0, 0], [1, 1]],
      orientations: [],
      down: [],
      dead: [],
    };
    const log = {
      durationMS: 1000,
      combatReplayMetaData: { pollingRate: 150 },
      players: [{
        account: 'Squad.1234',
        name: 'Squad Player',
        profession: 'Guardian',
        combatReplayData: actorReplay,
        totalDamageDist: [[]],
        rotation: [],
      }],
      targets: [
        { id: 42, instanceID: 1001, name: 'Enemy One', combatReplayData: actorReplay },
        { id: 42, instanceID: 1002, name: 'Enemy Two', combatReplayData: actorReplay },
      ],
    } as unknown as RawFightLog;

    expect(parseReplayData(log)?.enemies.map((enemy) => enemy.id)).toEqual(['target-1001', 'target-1002']);
  });
});

describe('interpolateFacing', () => {
  it('returns null for an empty track', () => {
    expect(interpolateFacing([], 500)).toBeNull();
  });

  it('does not hold stale facing outside the actor track', () => {
    const facings: ReplayFacingPoint[] = [
      { t: 0, angle: 10 },
      { t: 1000, angle: 20 },
    ];
    expect(interpolateFacing(facings, -100)).toBeNull();
    expect(interpolateFacing(facings, 5000)).toBeNull();
    expect(interpolateFacing(facings, 0)).toBe(10);
    expect(interpolateFacing(facings, 1000)).toBe(20);
  });

  it('linearly interpolates a normal (non-wrapping) angle change', () => {
    const facings: ReplayFacingPoint[] = [
      { t: 0, angle: 0 },
      { t: 1000, angle: 90 },
    ];
    expect(interpolateFacing(facings, 500)).toBeCloseTo(45);
  });

  it('takes the short way across the 0/360 wrap instead of the long way', () => {
    const facings: ReplayFacingPoint[] = [
      { t: 0, angle: 350 },
      { t: 1000, angle: 10 },
    ];
    const mid = interpolateFacing(facings, 500)!;
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
