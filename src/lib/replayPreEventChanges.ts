import type { ReplayData, ReplayEffectTrack, ReplayPlayerTrack } from "./parseReplayData";
import { distanceBetween, interpolatePosition, isInInterval } from "./parseReplayData";
import type { ReplayIntelligenceAnchor } from "./replayIntelligenceAnchors";

export interface ReplayPreEventMetric {
  key: "downOrDead" | "beyond600FromTag" | "stability" | "nearbySquad240" | "nearbyEnemies600";
  label: string;
  before: number;
  atEvent: number;
  delta: number;
  coverageBefore: number;
  coverageAtEvent: number;
  format: "count" | "average";
}

export interface ReplayPreEventChanges {
  lookbackMs: number;
  beforeTimestampMs: number;
  eventTimestampMs: number;
  metrics: ReplayPreEventMetric[];
}

function stacksAt(effect: ReplayEffectTrack, timestampMs: number): number {
  const states = effect.states ?? [];
  if (states.length === 0) return 0;
  let lo = 0;
  let hi = states.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (states[mid][0] <= timestampMs) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) return 0;
  const value = states[found][1];
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function resolvedParticipants(data: ReplayData, event: ReplayIntelligenceAnchor): ReplayPlayerTrack[] {
  return event.accounts
    .map((account) => data.players.find((player) => player.account === account) ?? null)
    .filter((player): player is ReplayPlayerTrack => player != null);
}

function countDownOrDead(players: ReplayPlayerTrack[], t: number): number {
  return players.filter((player) => isInInterval(player.downIntervals, t) || isInInterval(player.deadIntervals, t)).length;
}

function countBeyondTag(data: ReplayData, players: ReplayPlayerTrack[], t: number): { value: number; coverage: number } {
  const commander = data.players.find((player) => player.inSquad && player.isCommander) ?? null;
  const tagPoint = commander ? interpolatePosition(commander.points, t) : null;
  if (!tagPoint) return { value: 0, coverage: 0 };
  let value = 0;
  let coverage = 0;
  for (const player of players) {
    if (player.isCommander) continue;
    const point = interpolatePosition(player.points, t);
    const distance = distanceBetween(point, tagPoint);
    if (distance == null) continue;
    coverage += 1;
    if (distance > 600) value += 1;
  }
  return { value, coverage };
}

function countStability(players: ReplayPlayerTrack[], t: number): { value: number; coverage: number } {
  let value = 0;
  let coverage = 0;
  for (const player of players) {
    const effects = player.effects ?? [];
    if (effects.length === 0) continue;
    coverage += 1;
    const stability = effects.find(
      (effect) => effect.classification === "Boon" && effect.name.trim().toLowerCase() === "stability",
    );
    if (stability && stacksAt(stability, t) > 0) value += 1;
  }
  return { value, coverage };
}

function averageNearby(
  data: ReplayData,
  players: ReplayPlayerTrack[],
  t: number,
  side: "squad" | "enemy",
  radius: number,
): { value: number; coverage: number } {
  let total = 0;
  let coverage = 0;
  for (const player of players) {
    const point = interpolatePosition(player.points, t);
    if (!point || isInInterval(player.deadIntervals, t)) continue;
    coverage += 1;
    if (side === "squad") {
      total += data.players.filter((candidate) => {
        if (!candidate.inSquad || candidate.account === player.account || isInInterval(candidate.deadIntervals, t)) return false;
        const distance = distanceBetween(point, interpolatePosition(candidate.points, t));
        return distance != null && distance <= radius;
      }).length;
    } else {
      total += data.enemies.filter((enemy) => {
        if (isInInterval(enemy.deadIntervals, t)) return false;
        const distance = distanceBetween(point, interpolatePosition(enemy.points, t));
        return distance != null && distance <= radius;
      }).length;
    }
  }
  return { value: coverage > 0 ? total / coverage : 0, coverage };
}

function metric(
  key: ReplayPreEventMetric["key"],
  label: string,
  before: { value: number; coverage: number },
  atEvent: { value: number; coverage: number },
  format: ReplayPreEventMetric["format"],
): ReplayPreEventMetric {
  return {
    key,
    label,
    before: before.value,
    atEvent: atEvent.value,
    delta: atEvent.value - before.value,
    coverageBefore: before.coverage,
    coverageAtEvent: atEvent.coverage,
    format,
  };
}

/**
 * Compare proven Replay state at the Intelligence event with a short fixed
 * lookback. This is intentionally descriptive: it reports tracked changes
 * and coverage only, and does not claim that a change caused the event.
 */
export function buildReplayPreEventChanges(
  data: ReplayData,
  event: ReplayIntelligenceAnchor | null,
  lookbackMs = 5000,
): ReplayPreEventChanges | null {
  if (!event || !Number.isFinite(lookbackMs) || lookbackMs <= 0) return null;
  const eventTimestampMs = event.timestampMs;
  if (!Number.isFinite(eventTimestampMs) || eventTimestampMs < 0) return null;
  const beforeTimestampMs = Math.max(0, eventTimestampMs - lookbackMs);
  const participants = resolvedParticipants(data, event);
  if (participants.length === 0) return { lookbackMs, beforeTimestampMs, eventTimestampMs, metrics: [] };

  const downBefore = countDownOrDead(participants, beforeTimestampMs);
  const downAt = countDownOrDead(participants, eventTimestampMs);
  const tagBefore = countBeyondTag(data, participants, beforeTimestampMs);
  const tagAt = countBeyondTag(data, participants, eventTimestampMs);
  const stabilityBefore = countStability(participants, beforeTimestampMs);
  const stabilityAt = countStability(participants, eventTimestampMs);
  const squadBefore = averageNearby(data, participants, beforeTimestampMs, "squad", 240);
  const squadAt = averageNearby(data, participants, eventTimestampMs, "squad", 240);
  const enemyBefore = averageNearby(data, participants, beforeTimestampMs, "enemy", 600);
  const enemyAt = averageNearby(data, participants, eventTimestampMs, "enemy", 600);

  return {
    lookbackMs,
    beforeTimestampMs,
    eventTimestampMs,
    metrics: [
      metric("downOrDead", "Participants down/dead", { value: downBefore, coverage: participants.length }, { value: downAt, coverage: participants.length }, "count"),
      metric("beyond600FromTag", "Beyond 600 from tag", tagBefore, tagAt, "count"),
      metric("stability", "Participants with Stability", stabilityBefore, stabilityAt, "count"),
      metric("nearbySquad240", "Avg squad within 240", squadBefore, squadAt, "average"),
      metric("nearbyEnemies600", "Avg enemies within 600", enemyBefore, enemyAt, "average"),
    ].filter((entry) => entry.coverageBefore > 0 && entry.coverageAtEvent > 0),
  };
}
