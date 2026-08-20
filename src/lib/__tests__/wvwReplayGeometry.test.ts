import { describe, expect, it } from 'vitest';
import { mapPointToContinent } from '../replayWorldSpace';
import {
  getWvWReplayGeometry,
  mapPointToReplayPixel,
  replayPixelToMapPoint,
  WvW_REPLAY_GEOMETRIES,
} from '../wvwReplayGeometry';

describe('verified WvW Replay geometry', () => {
  it('supports the four WvW maps for which Elite Insights defines absolute replay geometry', () => {
    expect(Object.keys(WvW_REPLAY_GEOMETRIES).map(Number).sort((a, b) => a - b)).toEqual([38, 95, 96, 1099]);
    expect(getWvWReplayGeometry(38)?.name).toBe('Eternal Battlegrounds');
    expect(getWvWReplayGeometry(95)?.name).toBe('Green Alpine Borderlands');
    expect(getWvWReplayGeometry(96)?.name).toBe('Blue Alpine Borderlands');
    expect(getWvWReplayGeometry(1099)?.name).toBe('Red Desert Borderlands');
    expect(getWvWReplayGeometry(968)).toBeNull();
  });

  it('uses EI normalized JSON replay sizes rather than source-image dimensions', () => {
    expect(WvW_REPLAY_GEOMETRIES[38].replayPixelSize).toEqual([716, 750]);
    expect(WvW_REPLAY_GEOMETRIES[95].replayPixelSize).toEqual([523, 750]);
    expect(WvW_REPLAY_GEOMETRIES[96].replayPixelSize).toEqual([523, 750]);
    expect(WvW_REPLAY_GEOMETRIES[1099].replayPixelSize).toEqual([750, 750]);
  });

  it.each([38, 95, 96, 1099])('round-trips an interior map point through EI replay pixels on map %s', (mapId) => {
    const geometry = WvW_REPLAY_GEOMETRIES[mapId];
    const [topX, topY, bottomX, bottomY] = geometry.replayMapRect;
    const mapPoint: [number, number] = [
      topX + (bottomX - topX) * 0.37,
      topY + (bottomY - topY) * 0.63,
    ];

    const pixel = mapPointToReplayPixel(mapPoint, geometry);
    expect(pixel).not.toBeNull();
    const roundTrip = replayPixelToMapPoint(pixel!, geometry);
    expect(roundTrip).not.toBeNull();
    expect(roundTrip![0]).toBeCloseTo(mapPoint[0], 8);
    expect(roundTrip![1]).toBeCloseTo(mapPoint[1], 8);
  });

  it('maps replay pixel corners to EI replay-map corners with the exported Y inversion', () => {
    const geometry = WvW_REPLAY_GEOMETRIES[1099];
    expect(replayPixelToMapPoint([0, 0], geometry)).toEqual([-36864, 36864]);
    expect(replayPixelToMapPoint([750, 750], geometry)).toEqual([36864, -36864]);
  });

  it('preserves Eternal Battlegrounds EI replay offset instead of pretending it equals the full map rect', () => {
    const geometry = WvW_REPLAY_GEOMETRIES[38];
    expect(geometry.replayMapRect).toEqual([-35914, -34614, 37814, 39114]);
    expect(geometry.mapRect).toEqual([[-36864, -36864], [36864, 36864]]);

    // The full-map NW corner therefore does not land on replay pixel [0, 0].
    const fullMapNorthWest: [number, number] = [-36864, 36864];
    const pixel = mapPointToReplayPixel(fullMapNorthWest, geometry);
    expect(pixel).not.toBeNull();
    expect(pixel![0]).toBeLessThan(0);
    expect(pixel![1]).toBeGreaterThan(0);
  });

  it('can chain an EI replay pixel into official GW2 continent space without guessing', () => {
    const geometry = WvW_REPLAY_GEOMETRIES[1099];
    const mapPoint = replayPixelToMapPoint([375, 375], geometry);
    expect(mapPoint).toEqual([0, 0]);
    expect(mapPointToContinent(mapPoint!, geometry)).toEqual([10750, 10494]);
  });

  it('rejects invalid replay dimensions', () => {
    const geometry = WvW_REPLAY_GEOMETRIES[38];
    expect(replayPixelToMapPoint([10, 10], geometry, [0, 750])).toBeNull();
    expect(mapPointToReplayPixel([0, 0], geometry, [716, 0])).toBeNull();
  });
});
