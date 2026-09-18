export interface CombatChartPoint {
  time: number;
  dps: number | null;
  peers: number | null;
}

export interface CombatChartGeometry {
  dpsPath: string;
  peerPath: string;
  maximum: number;
}

const WIDTH = 1000;
const HEIGHT = 180;
const VERTICAL_PADDING = 8;

function coordinate(value: number) {
  return Math.round(value * 100) / 100;
}

function linePath(
  points: CombatChartPoint[],
  key: "dps" | "peers",
  durationMs: number,
  maximum: number,
) {
  let drawing = false;
  let path = "";

  for (const point of points) {
    const value = point[key];
    if (value === null || !Number.isFinite(value) || !Number.isFinite(point.time)) {
      drawing = false;
      continue;
    }

    const x = coordinate(Math.max(0, Math.min(WIDTH, point.time / durationMs * WIDTH)));
    const y = coordinate(HEIGHT - VERTICAL_PADDING - Math.max(0, value) / maximum * (HEIGHT - VERTICAL_PADDING * 2));
    path += `${drawing ? "L" : "M"}${x} ${y}`;
    drawing = true;
  }

  return path;
}

export function buildCombatChartGeometry(
  points: CombatChartPoint[],
  durationMs: number,
  includePeers: boolean,
): CombatChartGeometry {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return { dpsPath: "", peerPath: "", maximum: 1 };

  let maximum = 1;
  for (const point of points) {
    if (point.dps !== null && Number.isFinite(point.dps)) maximum = Math.max(maximum, point.dps);
    if (includePeers && point.peers !== null && Number.isFinite(point.peers)) maximum = Math.max(maximum, point.peers);
  }

  return {
    dpsPath: linePath(points, "dps", durationMs, maximum),
    peerPath: includePeers ? linePath(points, "peers", durationMs, maximum) : "",
    maximum,
  };
}

export function nearestCombatChartPoint(points: CombatChartPoint[], durationMs: number, ratio: number) {
  if (!points.length || !Number.isFinite(durationMs) || durationMs <= 0) return null;
  const target = Math.max(0, Math.min(1, ratio)) * durationMs;
  const index = Math.max(0, Math.min(points.length - 1, Math.round(target / 1000)));
  return points[index] ?? null;
}
