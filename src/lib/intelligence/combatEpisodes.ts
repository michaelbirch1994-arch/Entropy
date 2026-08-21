import type { AttributionConfidence } from "../combat/CombatEvent";
import type { EngagementSegment } from "./engagementTypes";
import type { CriticalEvent, FindingCategory } from "./types";

export type CombatEpisodeBasis = "persisted-segment" | "shared-evidence-window";

export interface CombatEpisode {
  id: string;
  fightId: string;
  startTimestampMs: number;
  endTimestampMs: number;
  durationMs: number;
  basis: CombatEpisodeBasis;
  confidence: AttributionConfidence;
  eventIds: string[];
  events: CriticalEvent[];
  kinds: string[];
  categories: FindingCategory[];
  relatedPlayers: string[];
}

export interface BuildCombatEpisodesOptions {
  sharedEvidenceWindowMs?: number;
}

const DEFAULT_SHARED_EVIDENCE_WINDOW_MS = 10_000;
const CONFIDENCE_RANK: Record<AttributionConfidence, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

function unique(items: readonly string[]): string[] {
  return [...new Set(items.filter((item) => item.length > 0))];
}

function weakestConfidence(
  events: readonly CriticalEvent[],
  segmentConfidence?: AttributionConfidence,
): AttributionConfidence {
  const values = [segmentConfidence, ...events.map((event) => event.confidence)]
    .filter((value): value is AttributionConfidence => Boolean(value));
  return values.reduce<AttributionConfidence>(
    (weakest, value) => CONFIDENCE_RANK[value] < CONFIDENCE_RANK[weakest] ? value : weakest,
    "high",
  );
}

function eventEvidenceIds(event: CriticalEvent): string[] {
  return unique([event.id, ...event.relatedEvents]);
}

function sharesExplicitEvidence(left: CriticalEvent, right: CriticalEvent): boolean {
  const leftPlayers = new Set(left.relatedPlayers ?? []);
  if ((right.relatedPlayers ?? []).some((player) => leftPlayers.has(player))) return true;

  const leftEvidence = new Set(eventEvidenceIds(left));
  return eventEvidenceIds(right).some((eventId) => leftEvidence.has(eventId));
}

function createEpisode(
  events: readonly CriticalEvent[],
  basis: CombatEpisodeBasis,
  segmentConfidence?: AttributionConfidence,
): CombatEpisode {
  const ordered = [...events].sort((a, b) => a.timestampMs - b.timestampMs || a.id.localeCompare(b.id));
  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  return {
    id: `combat-episode:${first.fightId}:${basis}:${first.id}`,
    fightId: first.fightId,
    startTimestampMs: first.timestampMs,
    endTimestampMs: last.timestampMs,
    durationMs: Math.max(0, last.timestampMs - first.timestampMs),
    basis,
    confidence: weakestConfidence(ordered, segmentConfidence),
    eventIds: ordered.map((event) => event.id),
    events: ordered,
    kinds: unique(ordered.map((event) => event.kind)),
    categories: unique(ordered.map((event) => event.category)) as FindingCategory[],
    relatedPlayers: unique(ordered.flatMap((event) => event.relatedPlayers ?? [])),
  };
}

function normalizedWindow(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_SHARED_EVIDENCE_WINDOW_MS;
  return Math.max(0, Math.floor(value as number));
}

/**
 * Groups already-recorded CriticalEvents into inspectable review episodes.
 *
 * This layer never creates or scores combat evidence. Persisted segment
 * membership is authoritative. Events outside a segment are grouped only when
 * they share an explicit player/event reference and occur inside the configured
 * review window. A group describes evidence worth reviewing together; it does
 * not assert that one event caused another.
 */
export function buildCombatEpisodes(
  criticalEvents: readonly CriticalEvent[],
  segments: readonly EngagementSegment[],
  options: BuildCombatEpisodesOptions = {},
): CombatEpisode[] {
  const validEvents = criticalEvents
    .filter((event) => event.id.length > 0 && event.fightId.length > 0 && Number.isFinite(event.timestampMs))
    .sort((a, b) => a.fightId.localeCompare(b.fightId) || a.timestampMs - b.timestampMs || a.id.localeCompare(b.id));
  const eventById = new Map(validEvents.map((event) => [event.id, event]));
  const assignedEventIds = new Set<string>();
  const episodes: CombatEpisode[] = [];

  [...segments]
    .sort((a, b) => a.fightId.localeCompare(b.fightId) || a.start.timestampMs - b.start.timestampMs || a.index - b.index)
    .forEach((segment) => {
      const events = unique(segment.criticalEventIds)
        .map((eventId) => eventById.get(eventId))
        .filter((event): event is CriticalEvent => Boolean(event))
        .filter((event) => event.fightId === segment.fightId)
        .filter((event) => !assignedEventIds.has(event.id));
      if (events.length < 2) return;
      episodes.push(createEpisode(events, "persisted-segment", segment.confidence));
      events.forEach((event) => assignedEventIds.add(event.id));
    });

  const windowMs = normalizedWindow(options.sharedEvidenceWindowMs);
  const remainingByFight = new Map<string, CriticalEvent[]>();
  validEvents.forEach((event) => {
    if (assignedEventIds.has(event.id)) return;
    const events = remainingByFight.get(event.fightId) ?? [];
    events.push(event);
    remainingByFight.set(event.fightId, events);
  });

  remainingByFight.forEach((events) => {
    let cluster: CriticalEvent[] = [];
    const flush = () => {
      if (cluster.length >= 2) episodes.push(createEpisode(cluster, "shared-evidence-window"));
      cluster = [];
    };

    events.forEach((event) => {
      if (cluster.length === 0) {
        cluster = [event];
        return;
      }

      const previous = cluster[cluster.length - 1];
      const insideWindow = event.timestampMs - previous.timestampMs <= windowMs;
      const explicitlyRelated = cluster.some((candidate) => sharesExplicitEvidence(candidate, event));
      if (insideWindow && explicitlyRelated) cluster.push(event);
      else {
        flush();
        cluster = [event];
      }
    });
    flush();
  });

  return episodes.sort((a, b) =>
    a.fightId.localeCompare(b.fightId)
    || a.startTimestampMs - b.startTimestampMs
    || a.id.localeCompare(b.id));
}
