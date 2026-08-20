import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { interpolatePosition, type ReplayPoint } from '../parseReplayData';

describe('Replay World-Space Phase 2 discontinuities', () => {
  it('does not interpolate across a long hole in EI position coverage', () => {
    const points: ReplayPoint[] = [
      { t: 0, x: 100, y: 100 },
      { t: 2000, x: 120, y: 100 },
    ];

    expect(interpolatePosition(points, 1000)).toBeNull();
    expect(interpolatePosition(points, 0)).toEqual(points[0]);
    expect(interpolatePosition(points, 2000)).toEqual(points[1]);
  });

  it('does not interpolate a teleport-sized adjacent position jump', () => {
    const points: ReplayPoint[] = [
      { t: 0, x: 100, y: 100 },
      { t: 150, x: 5000, y: 5000 },
    ];

    expect(interpolatePosition(points, 75)).toBeNull();
  });

  it('keeps Follow Focus from tracking a selected player while that player is dead', () => {
    const source = readFileSync(join(__dirname, '../../views/ReplayViewV2.tsx'), 'utf-8');

    expect(source).toContain(
      'selected && !isInInterval(selected.deadIntervals, t) ? interpolatePosition(selected.points, t) : null',
    );
  });
});
