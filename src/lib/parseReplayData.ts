// Extracts a scrubbable 2D position timeline from a raw Elite Insights fight
// log, for the replay viewer. Elite Insights only includes per-tick position
// data (`combatReplayData`) when the parse was run with replay output
// enabled - dps.report's getJson includes it for most modern parses, but
// older/alternate logs may not have it, so this returns null rather than
// throwing when it's missing and the UI shows a "not available" state.
//
// Confirmed against EI's JsonActorCombatReplayData / JsonCombatReplayMetaData
// JSON doc (baaron4.github.io/GW2-Elite-Insights-Parser). The real schema is
// NOT [time, x, y] triples (an earlier, unverified pass through this file
// assumed that and silently produced zero points for every fight, since
// every entry has length 2 and got filtered out): per-actor
// combatReplayData.positions is a flat list of [x, y] pairs sampled at a
// fixed cadence - the time for sample i is
// ceil(combatReplayData.start / pollingRate) * pollingRate + i * pollingRate,
// where pollingRate comes from the fight-level
// combatReplayMetaData.pollingRate (defaults to 150ms if that block is
// missing for some reason).

import type { RawFightLog } from "../types/rawFight";

export interface ReplayPoint {
  t: number;
  x: number;
  y: number;
}

export interface ReplayPlayerTrack {
  account: string;
  name: string;
  profession: string;
  inSquad: boolean;
  isCommander: boolean;
  points: ReplayPoint[];
  downIntervals: [number, number][];
  deadIntervals: [number, number][];
}

export interface ReplayData {
  durationMs: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  players: ReplayPlayerTrack[];
}

// combatReplayData.positions is a flat list of [x, y] pairs (NOT [t,x,y] -
// EI doesn't store a timestamp per sample, the cadence is fixed). Sample i's
// time is t0 + i*pollingRate, where t0 = ceil(start/pollingRate)*pollingRate.
function asPositionPoints(v: unknown, t0: number, pollingRate: number): ReplayPoint[] {
  if (!Array.isArray(v)) return [];
  const out: ReplayPoint[] = [];
  v.forEach((entry, i) => {
    if (!Array.isArray(entry) || entry.length < 2) return;
    const [x, y] = entry as unknown[];
    if (typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y)) {
      out.push({ t: t0 + i * pollingRate, x, y });
    }
  });
  return out;
}

function asIntervals(v: unknown): [number, number][] {
  if (!Array.isArray(v)) return [];
  const out: [number, number][] = [];
  for (const entry of v) {
    if (Array.isArray(entry) && entry.length >= 2 && typeof entry[0] === "number" && typeof entry[1] === "number") {
      out.push([entry[0], entry[1]]);
    }
  }
  return out;
}

export function parseReplayData(log: RawFightLog): ReplayData | null {
  const rawLog = log as unknown as Record<string, unknown>;
  const rawPlayers = (log.players ?? []) as unknown as Record<string, unknown>[];
  const replayMeta = (rawLog.combatReplayMetaData ?? {}) as Record<string, unknown>;
  const pollingRate = Number(replayMeta.pollingRate) > 0 ? Number(replayMeta.pollingRate) : 150;

  const players: ReplayPlayerTrack[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of rawPlayers) {
    const crd = p.combatReplayData as Record<string, unknown> | undefined;
    if (!crd) continue;
    const start = Number(crd.start) || 0;
    const t0 = Math.ceil(start / pollingRate) * pollingRate;
    const points = asPositionPoints(crd.positions, t0, pollingRate);
    if (points.length === 0) continue;

    for (const pt of points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }

    players.push({
      account: typeof p.account === "string" ? p.account : "Unknown",
      name: typeof p.name === "string" ? p.name : "Unknown",
      profession: typeof p.profession === "string" ? p.profession : "Unknown",
      inSquad: !p.notInSquad,
      isCommander: !!p.hasCommanderTag,
      points,
      downIntervals: asIntervals(crd.down),
      deadIntervals: asIntervals(crd.dead),
    });
  }

  if (players.length === 0 || !Number.isFinite(minX)) return null;

  const durationMs =
    typeof log.durationMS === "number" && log.durationMS > 0
      ? log.durationMS
      : Math.max(...players.map((p) => p.points[p.points.length - 1]?.t ?? 0));

  return { durationMs, bounds: { minX, maxX, minY, maxY }, players };
}

export function interpolatePosition(points: ReplayPoint[], t: number): ReplayPoint | null {
  if (points.length === 0) return null;
  if (t <= points[0].t) return points[0];
  if (t >= points[points.length - 1].t) return points[points.length - 1];
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  const span = b.t - a.t || 1;
  const f = (t - a.t) / span;
  return { t, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

export function isInInterval(intervals: [number, number][], t: number): boolean {
  return intervals.some(([s, e]) => t >= s && t <= e);
}
