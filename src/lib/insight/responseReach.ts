import type { ReplayPlayerTrack, ReplayPoint } from '../parseReplayData';

// Do not extrapolate across gaps or silently treat missing coordinates as zero.
function positionAt(points: ReplayPoint[] | undefined, time: number) {
  let before: ReplayPoint | undefined, after: ReplayPoint | undefined;
  for (const point of points ?? []) {
    if (![point.t, point.x, point.y].every(Number.isFinite)) continue;
    if (point.t <= time && (!before || point.t > before.t)) before = point;
    if (point.t >= time && (!after || point.t < after.t)) after = point;
  }
  if (!before || !after || after.t - before.t > 500) return null;
  const fraction = after.t === before.t ? 0 : (time - before.t) / (after.t - before.t);
  return { x: before.x + (after.x - before.x) * fraction, y: before.y + (after.y - before.y) * fraction };
}

export function responseReach(provider: ReplayPlayerTrack, target: ReplayPlayerTrack, time: number, scale: number | undefined, maxReach: number | null) {
  const from = positionAt(provider.points, time), to = positionAt(target.points, time);
  const distance = from && to && scale && Number.isFinite(scale) && scale > 0 ? Math.hypot(from.x - to.x, from.y - to.y) / scale : null;
  return { distanceUnits: distance === null ? null : Math.round(distance), maxReachUnits: maxReach,
    status: distance === null || maxReach === null ? 'Unknown' : distance > maxReach ? 'Outside reference reach' : 'Within reference reach',
    limitation: '2D position estimate only; elevation, line of sight, ground placement, target caps and movement during activation remain unresolved.' };
}
