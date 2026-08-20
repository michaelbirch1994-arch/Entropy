import type { RawFightLog } from '../types/rawFight';

export type Point2 = [number, number];
export type Rect2 = [Point2, Point2];

/**
 * Static geometry returned by GW2 API /v2/maps.
 * mapRect is SW -> NE in game-map coordinates.
 * continentRect is NW -> SE in continent/tile coordinates.
 */
export interface Gw2MapGeometry {
  mapRect: Rect2;
  continentRect: Rect2;
}

/**
 * Authoritative world-space identity carried by an EI JSON fight.
 *
 * WvWMapData is intentionally opaque in Phase 3. EI added this object to
 * represent WvW objective state, but Entropy must not guess at fields from an
 * unverified fixture. Keeping the raw object preserves evidence for Phase 4
 * while mapId is the stable GW2 API join key.
 */
export interface ReplayWorldSpaceMetadata {
  mapId: number | null;
  wvwMapData: unknown | null;
}

export function extractReplayWorldSpaceMetadata(log: RawFightLog): ReplayWorldSpaceMetadata {
  const raw = log as unknown as Record<string, unknown>;
  const rawMapId = raw.mapID ?? raw.mapId ?? raw.MapID;
  const mapId = typeof rawMapId === 'number' && Number.isFinite(rawMapId) && rawMapId > 0
    ? rawMapId
    : null;
  const wvwMapData = raw.wvwMapData ?? raw.WvWMapData ?? null;
  return { mapId, wvwMapData };
}

/**
 * Convert a GW2 map-space coordinate into the continent/tile coordinate
 * system using the documented /v2/maps rectangles.
 *
 * map_rect's Y axis grows north while continent_rect's Y axis grows south,
 * so Y is intentionally inverted. No EI replay-pixel coordinate is accepted
 * here; Phase 3 does not claim that calibration until it is proven.
 */
export function mapPointToContinent(point: Point2, geometry: Gw2MapGeometry): Point2 | null {
  const [[mapMinX, mapMinY], [mapMaxX, mapMaxY]] = geometry.mapRect;
  const [[continentMinX, continentMinY], [continentMaxX, continentMaxY]] = geometry.continentRect;
  const mapWidth = mapMaxX - mapMinX;
  const mapHeight = mapMaxY - mapMinY;
  if (!Number.isFinite(mapWidth) || !Number.isFinite(mapHeight) || mapWidth === 0 || mapHeight === 0) return null;

  const nx = (point[0] - mapMinX) / mapWidth;
  const nyFromNorth = (mapMaxY - point[1]) / mapHeight;
  return [
    continentMinX + nx * (continentMaxX - continentMinX),
    continentMinY + nyFromNorth * (continentMaxY - continentMinY),
  ];
}

/** Reverse of mapPointToContinent. */
export function continentPointToMap(point: Point2, geometry: Gw2MapGeometry): Point2 | null {
  const [[mapMinX, mapMinY], [mapMaxX, mapMaxY]] = geometry.mapRect;
  const [[continentMinX, continentMinY], [continentMaxX, continentMaxY]] = geometry.continentRect;
  const continentWidth = continentMaxX - continentMinX;
  const continentHeight = continentMaxY - continentMinY;
  if (!Number.isFinite(continentWidth) || !Number.isFinite(continentHeight) || continentWidth === 0 || continentHeight === 0) return null;

  const nx = (point[0] - continentMinX) / continentWidth;
  const nyFromNorth = (point[1] - continentMinY) / continentHeight;
  return [
    mapMinX + nx * (mapMaxX - mapMinX),
    mapMaxY - nyFromNorth * (mapMaxY - mapMinY),
  ];
}
