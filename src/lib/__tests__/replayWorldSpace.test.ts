import { describe, expect, it } from 'vitest';
import {
  continentPointToMap,
  extractReplayWorldSpaceMetadata,
  mapPointToContinent,
  type Gw2MapGeometry,
} from '../replayWorldSpace';
import type { RawFightLog } from '../../types/rawFight';

const queensdaleGeometry: Gw2MapGeometry = {
  mapRect: [[-43008, -27648], [43008, 30720]],
  continentRect: [[9856, 11648], [13440, 14080]],
};

describe('extractReplayWorldSpaceMetadata', () => {
  it('preserves EI mapID as the GW2 API join key', () => {
    const log = { mapID: 38 } as RawFightLog;
    expect(extractReplayWorldSpaceMetadata(log)).toEqual({ mapId: 38, wvwMapData: null });
  });

  it('preserves WvWMapData opaquely instead of guessing its schema', () => {
    const wvwMapData = { objectives: [{ id: '38-1', states: [[0, 'Red']] }] };
    const log = { mapID: 38, wvwMapData } as unknown as RawFightLog;
    expect(extractReplayWorldSpaceMetadata(log)).toEqual({ mapId: 38, wvwMapData });
  });

  it('keeps missing or invalid map ids unknown rather than inventing one', () => {
    expect(extractReplayWorldSpaceMetadata({} as RawFightLog).mapId).toBeNull();
    expect(extractReplayWorldSpaceMetadata({ mapID: 0 } as RawFightLog).mapId).toBeNull();
  });
});

describe('GW2 map/continent coordinate transform', () => {
  it('maps the NW map corner to the NW continent corner', () => {
    expect(mapPointToContinent([-43008, 30720], queensdaleGeometry)).toEqual([9856, 11648]);
  });

  it('maps the SE map corner to the SE continent corner', () => {
    expect(mapPointToContinent([43008, -27648], queensdaleGeometry)).toEqual([13440, 14080]);
  });

  it('round-trips an interior map coordinate', () => {
    const mapPoint: [number, number] = [1234, -5678];
    const continent = mapPointToContinent(mapPoint, queensdaleGeometry);
    expect(continent).not.toBeNull();
    const roundTrip = continentPointToMap(continent!, queensdaleGeometry);
    expect(roundTrip).not.toBeNull();
    expect(roundTrip![0]).toBeCloseTo(mapPoint[0], 6);
    expect(roundTrip![1]).toBeCloseTo(mapPoint[1], 6);
  });

  it('returns unknown for degenerate rectangles', () => {
    const invalid: Gw2MapGeometry = {
      mapRect: [[0, 0], [0, 100]],
      continentRect: [[0, 0], [100, 100]],
    };
    expect(mapPointToContinent([0, 50], invalid)).toBeNull();
  });
});
