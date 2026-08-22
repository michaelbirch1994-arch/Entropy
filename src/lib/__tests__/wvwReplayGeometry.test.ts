import { describe, expect, it } from "vitest";
import { mapPointToContinent } from "../replayWorldSpace";
import {
  getWvWReplayGeometry,
  mapPointToReplayPixel,
  replayPixelToMapPoint,
  WVW_REPLAY_GEOMETRIES,
} from "../wvwReplayGeometry";

describe("verified WvW Replay geometry", () => {
  it("supports the four WvW maps with absolute EI Replay geometry", () => {
    expect(Object.keys(WVW_REPLAY_GEOMETRIES).map(Number).sort((a, b) => a - b)).toEqual([38, 95, 96, 1099]);
    expect(getWvWReplayGeometry(38)?.name).toBe("Eternal Battlegrounds");
    expect(getWvWReplayGeometry(968)).toBeNull();
  });

  it.each([38, 95, 96, 1099])("round-trips a point through EI replay pixels on map %s", (mapId) => {
    const geometry = WVW_REPLAY_GEOMETRIES[mapId];
    const [topX, topY, bottomX, bottomY] = geometry.replayMapRect;
    const mapPoint: [number, number] = [
      topX + (bottomX - topX) * 0.37,
      topY + (bottomY - topY) * 0.63,
    ];
    const pixel = mapPointToReplayPixel(mapPoint, geometry);
    expect(pixel).not.toBeNull();
    const roundTrip = replayPixelToMapPoint(pixel!, geometry);
    expect(roundTrip![0]).toBeCloseTo(mapPoint[0], 8);
    expect(roundTrip![1]).toBeCloseTo(mapPoint[1], 8);
  });

  it("maps Replay pixel corners with EI's exported Y inversion", () => {
    const geometry = WVW_REPLAY_GEOMETRIES[1099];
    expect(replayPixelToMapPoint([0, 0], geometry)).toEqual([-36864, 36864]);
    expect(replayPixelToMapPoint([750, 750], geometry)).toEqual([36864, -36864]);
  });

  it("preserves the Eternal Battlegrounds replay offset", () => {
    const geometry = WVW_REPLAY_GEOMETRIES[38];
    expect(geometry.replayMapRect).toEqual([-35914, -34614, 37814, 39114]);
    const pixel = mapPointToReplayPixel([-36864, 36864], geometry);
    expect(pixel![0]).toBeLessThan(0);
    expect(pixel![1]).toBeGreaterThan(0);
  });

  it("bridges an EI Replay pixel into official GW2 continent space", () => {
    const geometry = WVW_REPLAY_GEOMETRIES[1099];
    const mapPoint = replayPixelToMapPoint([375, 375], geometry);
    expect(mapPoint).toEqual([0, 0]);
    expect(mapPointToContinent(mapPoint!, geometry)).toEqual([10750, 10494]);
  });

  it("rejects invalid replay dimensions", () => {
    const geometry = WVW_REPLAY_GEOMETRIES[38];
    expect(replayPixelToMapPoint([10, 10], geometry, [0, 750])).toBeNull();
    expect(mapPointToReplayPixel([0, 0], geometry, [716, 0])).toBeNull();
  });
});
