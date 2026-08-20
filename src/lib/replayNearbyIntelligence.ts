import type { ReplayIntelligenceAnchor } from "./replayIntelligenceAnchors";

export interface NearbyReplayIntelligenceEvent extends ReplayIntelligenceAnchor {
  offsetMs: number;
  distanceMs: number;
}

export function nearbyReplayIntelligenceEvents(
  anchors: ReplayIntelligenceAnchor[],
  fightIndex: number,
  timestampMs: number,
  windowMs = 5000,
): NearbyReplayIntelligenceEvent[] {
  if (!Number.isFinite(timestampMs) || !Number.isFinite(windowMs) || windowMs < 0) return [];

  return anchors
    .filter((anchor) => anchor.fightIndex === fightIndex)
    .map((anchor) => ({
      ...anchor,
      offsetMs: anchor.timestampMs - timestampMs,
      distanceMs: Math.abs(anchor.timestampMs - timestampMs),
    }))
    .filter((anchor) => anchor.distanceMs <= windowMs)
    .sort((a, b) => a.distanceMs - b.distanceMs || a.timestampMs - b.timestampMs || a.id.localeCompare(b.id));
}

export function alignedReplayIntelligenceEvent(
  anchors: ReplayIntelligenceAnchor[],
  fightIndex: number,
  timestampMs: number,
  thresholdMs = 750,
): NearbyReplayIntelligenceEvent | null {
  if (!Number.isFinite(thresholdMs) || thresholdMs < 0) return null;
  return nearbyReplayIntelligenceEvents(anchors, fightIndex, timestampMs, thresholdMs)[0] ?? null;
}
