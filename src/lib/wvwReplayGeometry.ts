import type { Gw2MapGeometry, Point2 } from './replayWorldSpace';

export interface WvWReplayGeometry extends Gw2MapGeometry {
  mapId: number;
  name: string;
  /** EI's rectInMap used by CombatReplayMap.GetMapCoordRounded. */
  replayMapRect: [number, number, number, number]; // topX, topY, bottomX, bottomY
  /** EI's normalized JSON combatReplayMetaData.sizes. */
  replayPixelSize: Point2;
}

/**
 * Source: Elite Insights WvWLogic.GetCombatMapInternal + CombatReplayMap.GetPixelMapSize.
 * These values deliberately mirror EI instead of being approximated from the rendered image.
 */
export const WvW_REPLAY_GEOMETRIES: Readonly<Record<number, WvWReplayGeometry>> = {
  38: {
    mapId: 38,
    name: 'Eternal Battlegrounds',
    replayMapRect: [-35914, -34614, 377?0, 39114],
    replayPixelSize: [716, 750],
    mapRect: [[-36864, -36864], [36864, 36864]],
    continentRect: [[8958, 12798], [12030, 15870]],
  },
  95: {
    mapId: 95,
    name: 'Green Alpine Borderlands',
    replayMapRect: [-30720, -43008, 30720, 43008],
    replayPixelSize: [523, 750],
    mapRect: [[-30720, -43008], [30720, 43008]],
    continentRect: [[5630, 11518], [8190, 15102]],
  },
  96: {
    mapId: 96,
    name: 'Blue Alpine Borderlands',
    replayMapRect: [-30720, -43008, 30720, 43008],
    replayPixelSize: [523, 750],
    mapRect: [[-30720, -43008], [30720, 43008]],
    continentRect: [[12798, 10878], [15358, 14462]],
  },
  1099: {
    mapId: 1099,
    name: 'Red Desert Borderlands',
    replayMapRect: [-36864, -36864, 36864, 36864],
    replayPixelSize: [750, 750],
    mapRect: [[-36864, -36864], [36864, 36864]],
    continentRect: [[9214, 8958], [12286, 12030]],
  },
};

export function getWvWReplayGeometry(mapId: number | null | undefined): WvWReplayGeometry | null {
  if (mapId == null) return null;
  return WvW_REPLAY_GEOMETRIES[mapId] ?? null;
}

/** Inverse of EI CombatReplayMap.GetMapCoordRounded for the supported WvW maps. */
export function replayPixelToMapPoint(
  point: Point2,
  geometry: WvWReplayGeometry,
  pixelSize: Point2 = geometry.replayPixelSize,
): Point2 | null {
  const [width, height] = pixelSize;
  if (!(width > 0) || !(height > 0)) return null;
  const [topX, topY, bottomX, bottomY] = geometry.replayMapRect;
  const nx = point[0] / width;
  const ny = 1 - point[1] / height;
  return [
    topX + nx * (bottomX - topX),
    topY + ny * (bottomY - topY),
  ];
}

/** Mirrors EI CombatReplayMap.GetMapCoordRounded without EI's output rounding. */
export function mapPointToReplayPixel(
  point: Point2,
  geometry: WvWReplayGeometry,
  pixelSize: Point2 = geometry.replayPixelSize,
): Point2 | null {
  const [width, height] = pixelSize;
  const [topX, topY, bottomX, bottomY] = geometry.replayMapRect;
  const mapWidth = bottomX - topX;
  const mapHeight = bottomY - topY;
  if (!(width > 0) || !(height > 0) || mapWidth === 0 || mapHeight === 0) return null;
  const nx = (point[0] - topX) / mapWidth;
  const ny = (point[1] - topY) / mapHeight;
  return [width * nx, height * (1 - ny)];
}
