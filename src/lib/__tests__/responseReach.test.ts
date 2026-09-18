import { expect, it } from 'vitest';
import { responseReach } from '../insight/responseReach';
import type { ReplayPlayerTrack } from '../parseReplayData';
const track = (points: { t: number; x: number; y: number }[]) => ({ points } as ReplayPlayerTrack);
it('interpolates nearby samples and uses replay scale', () => {
  const a = track([{ t: 0, x: 0, y: 0 }, { t: 200, x: 100, y: 0 }]);
  const b = track([{ t: 100, x: 150, y: 0 }]);
  expect(responseReach(a, b, 100, 0.5, 600)).toMatchObject({ distanceUnits: 200, status: 'Within reference reach' });
});
it('does not extrapolate, bridge missing data, or accept a missing calibration', () => {
  const a = track([{ t: 0, x: 0, y: 0 }, { t: 1000, x: 100, y: 0 }]);
  const b = track([{ t: 100, x: 150, y: 0 }]);
  expect(responseReach(a, b, 100, 1, 600).status).toBe('Unknown');
  expect(responseReach(b, b, 200, 1, 600).status).toBe('Unknown');
  expect(responseReach(b, b, 100, 0, 600).status).toBe('Unknown');
});
