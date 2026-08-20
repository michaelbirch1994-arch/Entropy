// Extracts a scrubbable 2D position timeline from a raw Elite Insights fight
// log, for the replay viewer. Elite Insights only includes per-tick position
// data (`combatReplayData`) when the parse was run with replay output
// enabled - dps.report's getJson includes it for most modern parses, but
// older/alternate logs may not have it, so this returns null rather than
// throwing when it's missing and the UI shows a "not available" state.
//
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
import { extractReplayWorldSpaceMetadata, type ReplayWorldSpaceMetadata } from "./replayWorldSpace";

export interface ReplayPoint {
  t: number;
  x: number;
  y: number;
}

export interface ReplayFacingPoint {
  t: number;
  angle: number;
}

export interface ReplayEffectTrack {
  id: number;
  name: string;
  icon?: string;
  classification: "Boon" | "Condition";
  states: [number, number][];
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
  facings: ReplayFacingPoint[];
  /**
   * Timestamped boon/condition state copied from EI's player buffUptimes.
   * This is persisted into Entropy's combined report so the first-class
   * Replay page can inspect the same live state that the raw-log replay popup
   * already exposes, even after the original upload object is gone.
   */
  effects: ReplayEffectTrack[];
  /**
   * Cast times of skills that actually dealt damage in this fight. These
   * mark WHERE AND WHEN a skill was cast - they are not the effect's real
   * area. EI does not export combat-replay decorations (no AoE geometry
   * exists anywhere in its JSON schema), so anything drawn from this is a
   * cast marker and must not be presented as an actual AoE footprint.
   */
  casts: { t: number; skillId: number }[];
}

// Hostile targets get a much thinner track than players - EI doesn't expose
// profession/commander-tag info for the enemy side. `id` is a synthetic,
// per-actor identity based on EI's instanceID (not the species id), so React
// never reconciles several enemy players through the same SVG element.
export interface ReplayEnemyTrack {
  id: string;
  name: string;
  points: ReplayPoint[];
  downIntervals: [number, number][];
  deadIntervals: [number, number][];
  facings: ReplayFacingPoint[];
}

// EI ships the actual combat-replay map imagery in
// combatReplayMetaData: `sizes` is the image size in pixels, `maps` is a
// list of background images each valid for a time interval (fights that
// cross a map boundary get more than one), and `position` is where that
// image's top-left sits in the shared pixel space. Crucially, the
// per-actor combatReplayData.positions are already expressed in that same
// pixel space, so tracks can be drawn straight onto the image with no
// conversion - inchToPixel is only needed to turn an in-game range in
// inches (a skill radius, say) into a pixel radius.
export interface ReplayMapImage {
  url: string;
  startMs: number;
  endMs: number;
  x: number;
  y: number;
}

export interface ReplayMapInfo {
  images: ReplayMapImage[];
  width: number;
  height: number;
  inchToPixel: number;
}

// A timestamped mechanic event (EI's raw.mechanics), resolved where
// possible to the squad member who triggered it so the replay can pin it
// to their position at that moment.
export interface ReplayMechanicMarker {
  t: number;
  name: string;
  severity: string;
  actor: string;
  account?: string;
}

export interface ReplayData {
  durationMs: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  players: ReplayPlayerTrack[];
  enemies: ReplayEnemyTrack[];
  map: ReplayMapInfo | null;
  worldSpace: ReplayWorldSpaceMetadata;
  mechanics: ReplayMechanicMarker[];
  skillMeta: Record<number, { name: string; icon?: string }>;
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

// EI's Orientations array (JsonActorCombatReplayData.Orientations) is a flat
// list of facing angles in degrees, sampled on the exact same cadence as
// Positions (same t0/pollingRate reconstruction). It is the actor's true
// facing direction, shipped directly by EI - not a movement-heading
// approximation. The rotation convention (which way 0deg points, cw vs ccw)
// hasn't been verified against a real replay export; if the on-map facing
// wedge looks mirrored or rotated once tested against a live log, adjust
// FACING_ANGLE_SIGN / FACING_ANGLE_OFFSET_DEG in ReplayView.tsx rather than
// here.
function asFacingPoints(v: unknown, t0: number, pollingRate: number): ReplayFacingPoint[] {
  if (!Array.isArray(v)) return [];
  const out: ReplayFacingPoint[] = [];
  v.forEach((entry, i) => {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      out.push({ t: t0 + i * pollingRate, angle: entry });
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

function asEffectStates(v: unknown): [number, number][] {
  if (!Array.isArray(v)) return [];
  const out: [number, number][] = [];
  for (const entry of v) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const time = Number(entry[0]);
    const stacks = Number(entry[1]);
    if (!Number.isFinite(time) || !Number.isFinite(stacks)) continue;
    out.push([time, stacks]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

function playerEffectTracks(
  player: Record<string, unknown>,
  buffMap: Record<string, { name?: string; icon?: string; classification?: string }>,
): ReplayEffectTrack[] {
  if (!Array.isArray(player.buffUptimes)) return [];
  const effects: ReplayEffectTrack[] = [];
  for (const rawEntry of player.buffUptimes as Array<Record<string, unknown>>) {
    const id = Number(rawEntry.id);
    if (!Number.isFinite(id)) continue;
    const states = asEffectStates(rawEntry.states);
    if (states.length === 0) continue;
    const meta = buffMap[`b${id}`] ?? buffMap[String(id)] ?? {};
    if (meta.classification !== "Boon" && meta.classification !== "Condition") continue;
    effects.push({
      id,
      name: typeof meta.name === "string" && meta.name ? meta.name : `Effect ${id}`,
      icon: typeof meta.icon === "string" ? meta.icon : undefined,
      classification: meta.classification,
      states,
    });
  }
  return effects.sort((a, b) => a.name.localeCompare(b.name));
}

// EI's "isFake" flag marks decoy/clone actors it still tracks combat for but
// that were never a real hostile player (illusions, siege placeholders,
// etc.) - excluded so the replay doesn't scatter phantom red dots that don't
// correspond to anything the squad actually fought as a person.
function isRealEnemyTarget(t: Record<string, unknown>): boolean {
  if (t.isFake === true) return false;
  return true;
}

function enemyTrackId(t: Record<string, unknown>, index: number): string {
  const instanceId = t.instanceID ?? t.instanceId;
  if ((typeof instanceId === "number" && Number.isFinite(instanceId)) || (typeof instanceId === "string" && instanceId.trim())) {
    return `target-${String(instanceId)}`;
  }

  // Some older exports omit instanceID. The species id is not unique, so the
  // source-array index remains part of the fallback identity.
  const speciesId = t.id;
  const species = typeof speciesId === "number" || typeof speciesId === "string" ? String(speciesId) : "unknown";
  return `target-${species}-${index}`;
}

export function parseReplayData(log: RawFightLog): ReplayData | null {
  const rawLog = log as unknown as Record<string, unknown>;
  const worldSpace = extractReplayWorldSpaceMetadata(log);
  const rawPlayers = (log.players ?? []) as unknown as Record<string, unknown>[];
  const rawTargets = (rawLog.targets ?? []) as unknown as Record<string, unknown>[];
  const replayMeta = (rawLog.combatReplayMetaData ?? {}) as Record<string, unknown>;
  const pollingRate = Number(replayMeta.pollingRate) > 0 ? Number(replayMeta.pollingRate) : 150;
  const buffMap = (rawLog.buffMap ?? {}) as Record<string, { name?: string; icon?: string; classification?: string }>;

  const sizes = Array.isArray(replayMeta.sizes) ? (replayMeta.sizes as unknown[]) : [];
  const mapWidth = Number(sizes[0]) || 0;
  const mapHeight = Number(sizes[1]) || 0;
  const rawMaps = Array.isArray(replayMeta.maps) ? (replayMeta.maps as Record<string, unknown>[]) : [];
  const mapImages: ReplayMapImage[] = [];
  for (const m of rawMaps) {
    const url = typeof m.url === "string" ? m.url : null;
    if (!url) continue;
    const interval = Array.isArray(m.interval) ? (m.interval as unknown[]) : [];
    const pos = Array.isArray(m.position) ? (m.position as unknown[]) : [];
    mapImages.push({
      // EI emits protocol-relative urls for these; an https page refuses
      // to load them as-is.
      url: url.startsWith("//") ? `https:${url}` : url.replace(/^http:\/\//i, "https://"),
      startMs: Number(interval[0]) || 0,
      endMs: Number(interval[1]) || 0,
      x: Number(pos[0]) || 0,
      y: Number(pos[1]) || 0,
    });
  }
  const map: ReplayMapInfo | null =
    mapImages.length > 0 && mapWidth > 0 && mapHeight > 0
      ? { images: mapImages, width: mapWidth, height: mapHeight, inchToPixel: Number(replayMeta.inchToPixel) || 0 }
      : null;

  // Skill names/icons for cast markers, and the set of skills that actually
  // dealt damage - a raw cast timeline is mostly weapon swaps, dodges and
  // utility, which would bury the map in meaningless pips.
  const skillMap = (rawLog.skillMap ?? {}) as Record<string, { name?: string; icon?: string }>;
  const skillMeta: Record<number, { name: string; icon?: string }> = {};
  for (const key of Object.keys(skillMap)) {
    const id = Number(key.replace(/^s/, ""));
    const def = skillMap[key];
    if (Number.isFinite(id) && def?.name) skillMeta[id] = { name: def.name, icon: def.icon };
  }
  const damagingSkillIds = new Set<number>();
  for (const p of rawPlayers) {
    const dist = ((p.totalDamageDist ?? []) as Array<Array<{ id?: number; totalDamage?: number }>>)[0] ?? [];
    for (const e of dist) {
      const sid = Number(e?.id);
      if (Number.isFinite(sid) && (Number(e?.totalDamage) || 0) > 0) damagingSkillIds.add(sid);
    }
  }

  const players: ReplayPlayerTrack[] = [];
  const enemies: ReplayEnemyTrack[] = [];
  const allX: number[] = [];
  const allY: number[] = [];
  for (const p of rawPlayers) {
    const crd = p.combatReplayData as Record<string, unknown> | undefined;
    if (!crd) continue;
    const start = Number(crd.start) || 0;
    const t0 = Math.ceil(start / pollingRate) * pollingRate;
    const points = asPositionPoints(crd.positions, t0, pollingRate);
    if (points.length === 0) continue;
    const facings = asFacingPoints(crd.orientations, t0, pollingRate);

    for (const pt of points) {
      allX.push(pt.x);
      allY.push(pt.y);
    }

    const casts: { t: number; skillId: number }[] = [];
    for (const entry of (p.rotation ?? []) as Array<{ id?: number; skills?: Array<{ castTime?: number }> }>) {
      const skillId = Number(entry?.id);
      if (!Number.isFinite(skillId) || !damagingSkillIds.has(skillId)) continue;
      for (const sk of entry.skills ?? []) {
        casts.push({ t: Number(sk?.castTime) || 0, skillId });
      }
    }
    casts.sort((a, b) => a.t - b.t);

    players.push({
      account: typeof p.account === "string" ? p.account : "Unknown",
      name: typeof p.name === "string" ? p.name : "Unknown",
      profession: typeof p.profession === "string" ? p.profession : "Unknown",
      inSquad: !p.notInSquad,
      isCommander: !!p.hasCommanderTag,
      points,
      downIntervals: asIntervals(crd.down),
      deadIntervals: asIntervals(crd.dead),
      facings,
      effects: playerEffectTracks(p, buffMap),
      casts,
    });
  }

  rawTargets.forEach((t, idx) => {
    if (!isRealEnemyTarget(t)) return;
    const crd = t.combatReplayData as Record<string, unknown> | undefined;
    if (!crd) return;
    const start = Number(crd.start) || 0;
    const t0 = Math.ceil(start / pollingRate) * pollingRate;
    const points = asPositionPoints(crd.positions, t0, pollingRate);
    if (points.length === 0) return;
    const facings = asFacingPoints(crd.orientations, t0, pollingRate);

    for (const pt of points) {
      allX.push(pt.x);
      allY.push(pt.y);
    }

    enemies.push({
      id: enemyTrackId(t, idx),
      name: typeof t.name === "string" ? t.name : "Enemy",
      points,
      facings,
      downIntervals: asIntervals(crd.down),
      deadIntervals: asIntervals(crd.dead),
    });
  });

  if (players.length === 0 || allX.length === 0) return null;

  // Bounds use a percentile-trimmed range rather than raw min/max. A single
  // stray combat-replay sample (an actor briefly at their WvW spawn camp far
  // across the map, a teleport/waypoint blip, or a bad EI position sample)
  // can otherwise blow the fitted view out by orders of magnitude, shrinking
  // the actual fight to a speck and inflating every marker/line drawn at
  // that scale into a huge smear across the map - this produced the giant
  // trailing "blob" artifacts some users were seeing, not a render/paint
  // bug. Clipping to the 1st-99th percentile keeps the fitted frame sized to
  // where the fight actually happened.
  function percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
    return sorted[idx];
  }
  const minX = percentile(allX, 0.01);
  const maxX = percentile(allX, 0.99);
  const minY = percentile(allY, 0.01);
  const maxY = percentile(allY, 0.99);

  const durationMs =
    typeof log.durationMS === "number" && log.durationMS > 0
      ? log.durationMS
      : Math.max(...players.map((p) => p.points[p.points.length - 1]?.t ?? 0));

  // Mechanic events (EI raw.mechanics). JsonMechanic.Id is the species id of
  // whoever triggered it, 0 meaning a player - those are matched back to an
  // account via character name, the only identifier the event carries, so the
  // replay can pin the marker to that player's position at that instant.
  const nameToAccount = new Map<string, string>();
  for (const p of rawPlayers) {
    const nm = typeof p.name === "string" ? p.name : null;
    const acc = typeof p.account === "string" ? p.account : null;
    if (nm && acc) nameToAccount.set(nm, acc);
  }
  const mechanics: ReplayMechanicMarker[] = [];
  for (const m of (rawLog.mechanics ?? []) as Array<Record<string, unknown>>) {
    const mName = typeof m.name === "string" ? m.name : "Mechanic";
    const severity = typeof m.severity === "string" ? m.severity : "Sev0";
    const events = Array.isArray(m.mechanicsData) ? (m.mechanicsData as Record<string, unknown>[]) : [];
    for (const e of events) {
      const actor = typeof e.actor === "string" && e.actor ? e.actor : "Unknown";
      mechanics.push({
        t: Number(e.time) || 0,
        name: mName,
        severity,
        actor,
        account: Number(e.id) === 0 ? nameToAccount.get(actor) : undefined,
      });
    }
  }
  mechanics.sort((a, b) => a.t - b.t);

  return { durationMs, bounds: { minX, maxX, minY, maxY }, players, enemies, map, worldSpace, mechanics, skillMeta };
}

// Reasonable data gaps happen: samples land at a fixed cadence (150ms by
// default) but disappear for stretches during disconnects, waypoints/portals
// taken while still alive (not covered by deadIntervals), zone transitions, or
// plain holes in what EI captured. Bridging one of these gaps with a straight-
// line lerp draws a fast, unbroken streak clear across the map between the two
// real positions on either side of the gap - this is the "drawing line" /
// trailing-line artifact players kept reporting even after the facing-angle
// and SVG paint-compositing fixes, because neither of those touched the data
// layer where this actually happens. If the two bracketing samples are farther
// apart than MAX_INTERP_GAP_MS, treat the position/facing as unknown for that
// stretch instead of interpolating across it.
const MAX_INTERP_GAP_MS = 1500;
// EI positions may remain temporally contiguous across a waypoint, portal,
// map transfer, or bad sample. Moving more than 1,000 coordinate units per
// second is far beyond normal player motion but remains generous enough for
// leaps and movement skills. Treat larger segments as discontinuities so a
// dot disappears and reappears instead of being animated across the map.
const MAX_INTERP_SPEED_UNITS_PER_MS = 1;

export function interpolatePosition(points: ReplayPoint[], t: number): ReplayPoint | null {
  if (points.length === 0) return null;
  // Do not pin an actor to its first/last known sample outside the interval EI
  // actually tracked. WvW targets frequently enter/leave awareness mid-fight;
  // clamping made those actors look permanently frozen on the map while the
  // fight clock, mechanics, and casts kept advancing. Unknown position must be
  // rendered as absent, not as a stationary ghost.
  if (t < points[0].t || t > points[points.length - 1].t) return null;
  if (t === points[0].t) return points[0];
  if (t === points[points.length - 1].t) return points[points.length - 1];
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  if (t === a.t) return a;
  if (t === b.t) return b;
  const span = b.t - a.t || 1;
  if (span > MAX_INTERP_GAP_MS) return null;
  if (Math.hypot(b.x - a.x, b.y - a.y) > span * MAX_INTERP_SPEED_UNITS_PER_MS) return null;
  const f = (t - a.t) / span;
  return { t, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

// Circular interpolation for facing angles (degrees). A plain linear lerp
// breaks down across the 0/360 wrap (350deg -> 10deg would lerp "the long
// way" through 180 instead of the actual 20deg turn), so this picks the
// shortest angular delta between the two bracketing samples first.
export function interpolateFacing(facings: ReplayFacingPoint[], t: number): number | null {
  if (facings.length === 0) return null;
  if (t < facings[0].t || t > facings[facings.length - 1].t) return null;
  if (t === facings[0].t) return facings[0].angle;
  if (t === facings[facings.length - 1].t) return facings[facings.length - 1].angle;
  let lo = 0;
  let hi = facings.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (facings[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = facings[lo];
  const b = facings[hi];
  const span = b.t - a.t || 1;
  if (span > MAX_INTERP_GAP_MS) return null;
  const f = (t - a.t) / span;
  const delta = ((b.angle - a.angle + 540) % 360) - 180;
  return a.angle + delta * f;
}

export function isInInterval(intervals: [number, number][], t: number): boolean {
  return intervals.some(([s, e]) => t >= s && t <= e);
}

// Straight-line distance between two live replay points - used to compute a
// live "average distance to commander" readout as the fight scrubs, the same
// unit EI/dps.report position data is already in (in-game units, not meters,
// but consistent for a relative "spread" read).
export function distanceBetween(a: ReplayPoint | null, b: ReplayPoint | null): number | null {
  if (!a || !b) return null;
  return Math.hypot(a.x - b.x, a.y - b.y);
}
