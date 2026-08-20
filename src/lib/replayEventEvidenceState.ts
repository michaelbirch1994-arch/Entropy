import type { ReplayData, ReplayEffectTrack } from "./parseReplayData";
import { distanceBetween, interpolatePosition, isInInterval } from "./parseReplayData";
import type { ReplayIntelligenceAnchor } from "./replayIntelligenceAnchors";

export interface ReplayEventEvidenceState {
  eventId: string;
  kind: string;
  category: string;
  confidence: ReplayIntelligenceAnchor["confidence"];
  summary: string;
  trackedParticipants: number;
  activeParticipants: number;
  downedParticipants: number;
  deadParticipants: number;
  untrackedParticipants: number;
  beyond600FromTag: number;
  stabilityPresent: number;
  stabilityKnownFor: number;
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
  const stacks = states[found][1];
  return Number.isFinite(stacks) && stacks > 0 ? stacks : 0;
}

/**
 * Build an exact-time, evidence-only summary for a Replay Intelligence event.
 * Every player included here has already been resolved against the exact
 * replay-fight roster by buildReplayIntelligenceAnchors. Missing position or
 * effect state remains explicitly unknown instead of being treated as zero.
 */
export function buildReplayEventEvidenceState(
  data: ReplayData,
  event: ReplayIntelligenceAnchor | null,
  timestampMs: number,
): ReplayEventEvidenceState | null {
  if (!event || !Number.isFinite(timestampMs)) return null;

  const participants = event.accounts
    .map((account) => data.players.find((player) => player.account === account) ?? null)
    .filter((player): player is NonNullable<typeof player> => player != null);

  const commander = data.players.find((player) => player.inSquad && player.isCommander) ?? null;
  const commanderPoint = commander ? interpolatePosition(commander.points, timestampMs) : null;

  let activeParticipants = 0;
  let downedParticipants = 0;
  let deadParticipants = 0;
  let untrackedParticipants = 0;
  let beyond600FromTag = 0;
  let stabilityPresent = 0;
  let stabilityKnownFor = 0;

  for (const player of participants) {
    const point = interpolatePosition(player.points, timestampMs);
    const dead = isInInterval(player.deadIntervals, timestampMs);
    const down = !dead && isInInterval(player.downIntervals, timestampMs);

    if (dead) deadParticipants += 1;
    else if (down) downedParticipants += 1;
    else if (!point) untrackedParticipants += 1;
    else activeParticipants += 1;

    if (point && commanderPoint && !player.isCommander) {
      const distance = distanceBetween(point, commanderPoint);
      if (distance != null && distance > 600) beyond600FromTag += 1;
    }

    const effects = player.effects ?? [];
    if (effects.length > 0) {
      stabilityKnownFor += 1;
      const stability = effects.find(
        (effect) => effect.classification === "Boon" && effect.name.trim().toLowerCase() === "stability",
      );
      if (stability && stacksAt(stability, timestampMs) > 0) stabilityPresent += 1;
    }
  }

  return {
    eventId: event.id,
    kind: event.kind,
    category: event.category,
    confidence: event.confidence,
    summary: event.summary,
    trackedParticipants: participants.length,
    activeParticipants,
    downedParticipants,
    deadParticipants,
    untrackedParticipants,
    beyond600FromTag,
    stabilityPresent,
    stabilityKnownFor,
  };
}
