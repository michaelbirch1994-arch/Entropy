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
}

export interface BuildEventInspectionInput {
  event: CriticalEvent;
  segments: readonly EngagementSegment[];
  findings: readonly IntelligenceFinding[];
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
  beforeMs,
  afterMs,
}: BuildEventInspectionInput): IntelligenceEventInspection {
  const before = nonNegativeWindow(beforeMs, DEFAULT_BEFORE_MS);
  const after = nonNegativeWindow(afterMs, DEFAULT_AFTER_MS);
  const anchor = Math.max(0, Math.floor(event.timestampMs));

  const relatedSegments = segments
    .filter((segment) => segment.fightId === event.fightId)
    .filter((segment) => segmentReferencesEvent(segment, event) || segmentContainsTimestamp(segment, anchor))
    .sort((a, b) => a.start.timestampMs - b.start.timestampMs || a.index - b.index);

  const relatedFindings = findings
    .filter((finding) => findingReferencesEvent(finding, event))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    event,
    window: {
      anchorTimestampMs: anchor,
      startTimestampMs: Math.max(0, anchor - before),
      endTimestampMs: anchor + after,
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
  };
}
