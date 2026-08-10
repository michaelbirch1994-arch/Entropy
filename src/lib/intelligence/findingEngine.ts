import { createFinding, type CriticalEvent, type Evidence, type IntelligenceFinding } from './types';
import type { EngagementSegment } from './engagementTypes';

export interface FindingEngineInput {
  fightId: string;
  segments: EngagementSegment[];
  criticalEvents: CriticalEvent[];
}

const unique = <T>(items: T[]): T[] => [...new Set(items)];

const criticalEventMap = (events: CriticalEvent[]): Map<string, CriticalEvent> =>
  new Map(events.map((event) => [event.id, event]));

const segmentCriticalEvents = (
  segment: EngagementSegment,
  byId: Map<string, CriticalEvent>,
): CriticalEvent[] =>
  segment.criticalEventIds
    .map((id) => byId.get(id))
    .filter((event): event is CriticalEvent => event !== undefined);

const hasKind = (events: CriticalEvent[], kind: string): boolean =>
  events.some((event) => event.kind === kind);

const relatedEventIds = (segment: EngagementSegment, events: CriticalEvent[]): string[] =>
  unique([...segment.combatEventIds, ...events.flatMap((event) => event.relatedEvents)]);

const relatedPlayerKeys = (segment: EngagementSegment, events: CriticalEvent[]): string[] =>
  unique([...segment.participantKeys, ...events.flatMap((event) => event.relatedPlayers ?? [])]);

const confidenceFor = (eventCount: number): IntelligenceFinding['confidence'] =>
  eventCount >= 3 ? 'strong-correlation' : 'correlation';

function baseEvidence(
  segment: EngagementSegment,
  events: CriticalEvent[],
  relatedEvents: string[],
  relatedPlayers: string[],
  statement: string,
): Evidence {
  return {
    statement,
    metrics: {
      segmentIndex: segment.index,
      criticalEventCount: events.length,
      downs: segment.downs,
      deaths: segment.deaths,
      durationMs: segment.durationMs,
    },
    relatedEvents,
    relatedPlayers,
  };
}

/**
 * Converts deterministic engagement evidence into inspectable IntelligenceFindings.
 *
 * Scope:
 * - no AI prose generation;
 * - no 0-100 scores;
 * - no recommendations yet;
 * - no likely-causal claims.
 */
export function synthesizeFindings(input: FindingEngineInput): IntelligenceFinding[] {
  const byId = criticalEventMap(input.criticalEvents);
  const findings: IntelligenceFinding[] = [];
  const emitted = new Set<string>();

  for (const segment of input.segments) {
    const events = segmentCriticalEvents(segment, byId);
    if (events.length === 0) continue;

    const relatedEvents = relatedEventIds(segment, events);
    const relatedPlayers = relatedPlayerKeys(segment, events);

    const emit = (
      key: string,
      finding: Omit<IntelligenceFinding, 'evidence'> & { evidence: [Evidence, ...Evidence[]] },
    ) => {
      const dedupeKey = `${segment.id}:${key}`;
      if (emitted.has(dedupeKey)) return;
      emitted.add(dedupeKey);
      findings.push(createFinding(finding));
    };

    if (
      hasKind(events, 'defensive-failure') &&
      (hasKind(events, 'mass-down') || hasKind(events, 'failed-recovery'))
    ) {
      emit('defensive-collapse', {
        id: `finding:defensive-collapse:${segment.id}`,
        title: 'Defensive collapse',
        category: 'defense',
        severity: segment.deaths > 0 ? 'critical' : 'significant',
        confidence: confidenceFor(events.length),
        summary: 'This engagement contains defensive-failure evidence clustered with squad down/death pressure.',
        relatedEvents,
        relatedPlayers,
        relatedFight: input.fightId,
        evidence: [
          baseEvidence(
            segment,
            events,
            relatedEvents,
            relatedPlayers,
            'Defensive-failure evidence appears in the same engagement as mass-down or failed-recovery evidence.',
          ),
        ],
      });
    }

    if (
      hasKind(events, 'squad-separation') &&
      (segment.downs > 0 || segment.deaths > 0 || hasKind(events, 'mass-down') || hasKind(events, 'failed-recovery'))
    ) {
      emit('positioning-collapse', {
        id: `finding:positioning-collapse:${segment.id}`,
        title: 'Positioning collapse',
        category: 'positioning',
        severity: segment.deaths > 0 ? 'critical' : 'significant',
        confidence: confidenceFor(events.length),
        summary: 'This engagement contains squad-separation evidence near down/death or failed-recovery pressure.',
        relatedEvents,
        relatedPlayers,
        relatedFight: input.fightId,
        evidence: [
          baseEvidence(
            segment,
            events,
            relatedEvents,
            relatedPlayers,
            'Squad-separation evidence occurred in the same engagement as down/death or recovery-failure evidence.',
          ),
        ],
      });
    }

    if (
      hasKind(events, 'enemy-spike') &&
      (hasKind(events, 'mass-down') || hasKind(events, 'failed-recovery') || segment.downs > 0 || segment.deaths > 0)
    ) {
      emit('spike-collapse', {
        id: `finding:spike-collapse:${segment.id}`,
        title: 'Spike collapse',
        category: 'defense',
        severity: segment.deaths > 0 ? 'critical' : 'significant',
        confidence: confidenceFor(events.length),
        summary: 'This engagement contains enemy-spike evidence connected to squad down/death pressure.',
        relatedEvents,
        relatedPlayers,
        relatedFight: input.fightId,
        evidence: [
          baseEvidence(
            segment,
            events,
            relatedEvents,
            relatedPlayers,
            'Enemy-spike evidence occurred in the same engagement as down/death, mass-down, or failed-recovery evidence.',
          ),
        ],
      });
    }

    if (hasKind(events, 'failed-recovery') && segment.deaths > 0) {
      emit('failed-recovery-cluster', {
        id: `finding:failed-recovery-cluster:${segment.id}`,
        title: 'Failed recovery cluster',
        category: 'defense',
        severity: 'significant',
        confidence: confidenceFor(events.length),
        summary: 'This engagement contains failed-recovery evidence and confirmed deaths.',
        relatedEvents,
        relatedPlayers,
        relatedFight: input.fightId,
        evidence: [
          baseEvidence(
            segment,
            events,
            relatedEvents,
            relatedPlayers,
            'Failed-recovery evidence occurred in an engagement with one or more deaths.',
          ),
        ],
      });
    }
  }

  return findings;
}
