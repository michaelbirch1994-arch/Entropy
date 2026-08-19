import type { EngagementSegment } from './engagementTypes';
import type { CriticalEvent, IntelligenceFinding } from './types';

export interface IntelligenceEventWindow {
  anchorTimestampMs: number;
  startTimestampMs: number;
  endTimestampMs: number;
  beforeMs: number;
  afterMs: number;
}

export interface IntelligenceEventInspection {
  event: CriticalEvent;
  window: IntelligenceEventWindow;
  relatedSegments: EngagementSegment[];
  relatedFindings: IntelligenceFinding[];
  relatedEventIds: string[];
  relatedPlayerKeys: string[];
  /** Other real CriticalEvents in the same fight and inspection window. */
  nearbyEvents: CriticalEvent[];
  /** Nearby events strictly before the selected event, chronological. */
  eventsBefore: CriticalEvent[];
  /** Nearby events at/after the selected timestamp, chronological. */
  eventsAfter: CriticalEvent[];
}

export interface BuildEventInspectionInput {
  event: CriticalEvent;
  segments: readonly EngagementSegment[];
  findings: readonly IntelligenceFinding[];
  /** Optional complete CriticalEvent set for reconstructing the surrounding moment. */
  criticalEvents?: readonly CriticalEvent[];
  beforeMs?: number;
  afterMs?: number;
}

const DEFAULT_BEFORE_MS = 15_000;
const DEFAULT_AFTER_MS = 15_000;

function nonNegativeWindow(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value as number));
}

function unique(items: readonly string[]): string[] {
  return [...new Set(items.filter((item) => item.length > 0))];
}

function segmentContainsTimestamp(segment: EngagementSegment, timestampMs: number): boolean {
  return timestampMs >= segment.start.timestampMs && timestampMs <= segment.end.timestampMs;
}

function segmentReferencesEvent(segment: EngagementSegment, event: CriticalEvent): boolean {
  return segment.criticalEventIds.includes(event.id)
    || event.relatedEvents.some((eventId) => segment.combatEventIds.includes(eventId));
}

function findingReferencesEvent(finding: IntelligenceFinding, event: CriticalEvent): boolean {
  if (finding.relatedFight !== event.fightId) return false;
  if (finding.relatedEvents.includes(event.id)) return true;
  if (event.relatedEvents.some((eventId) => finding.relatedEvents.includes(eventId))) return true;
  return finding.evidence.some((evidence) =>
    evidence.relatedEvents?.includes(event.id)
    || event.relatedEvents.some((eventId) => evidence.relatedEvents?.includes(eventId)),
  );
}

function eventsInsideWindow(
  events: readonly CriticalEvent[],
  selected: CriticalEvent,
  startTimestampMs: number,
  endTimestampMs: number,
): CriticalEvent[] {
  return events
    .filter((candidate) => candidate.id !== selected.id)
    .filter((candidate) => candidate.fightId === selected.fightId)
    .filter((candidate) => Number.isFinite(candidate.timestampMs))
    .filter((candidate) => candidate.timestampMs >= startTimestampMs && candidate.timestampMs <= endTimestampMs)
    .sort((a, b) => a.timestampMs - b.timestampMs || a.id.localeCompare(b.id));
}

/**
 * Builds the inspectable context for an existing CriticalEvent.
 *
 * This deliberately does not calculate new combat metrics or infer missing state.
 * It only connects already-persisted Intelligence evidence around one real event so
 * the Intelligence tab can deepen into the existing Entropy viewer without
 * creating a second source of truth.
 */
export function buildEventInspection({
  event,
  segments,
  findings,
  criticalEvents = [],
  beforeMs,
  afterMs,
}: BuildEventInspectionInput): IntelligenceEventInspection {
  const before = nonNegativeWindow(beforeMs, DEFAULT_BEFORE_MS);
  const after = nonNegativeWindow(afterMs, DEFAULT_AFTER_MS);
  const anchor = Math.max(0, Math.floor(event.timestampMs));
  const startTimestampMs = Math.max(0, anchor - before);
  const endTimestampMs = anchor + after;

  const relatedSegments = segments
    .filter((segment) => segment.fightId === event.fightId)
    .filter((segment) => segmentReferencesEvent(segment, event) || segmentContainsTimestamp(segment, anchor))
    .sort((a, b) => a.start.timestampMs - b.start.timestampMs || a.index - b.index);

  const relatedFindings = findings
    .filter((finding) => findingReferencesEvent(finding, event))
    .sort((a, b) => a.id.localeCompare(b.id));

  const nearbyEvents = eventsInsideWindow(criticalEvents, event, startTimestampMs, endTimestampMs);
  const eventsBefore = nearbyEvents.filter((candidate) => candidate.timestampMs < anchor);
  const eventsAfter = nearbyEvents.filter((candidate) => candidate.timestampMs >= anchor);

  return {
    event,
    window: {
      anchorTimestampMs: anchor,
      startTimestampMs,
      endTimestampMs,
      beforeMs: before,
      afterMs: after,
    },
    relatedSegments,
    relatedFindings,
    relatedEventIds: unique([event.id, ...event.relatedEvents]),
    relatedPlayerKeys: unique([
      ...(event.relatedPlayers ?? []),
      ...relatedSegments.flatMap((segment) => segment.participantKeys),
      ...relatedFindings.flatMap((finding) => finding.relatedPlayers ?? []),
    ]),
    nearbyEvents,
    eventsBefore,
    eventsAfter,
  };
}
