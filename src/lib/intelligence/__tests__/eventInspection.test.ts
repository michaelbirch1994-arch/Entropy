import { describe, expect, it } from 'vitest';
import { buildEventInspection } from '../eventInspection';
import type { CriticalEvent, IntelligenceFinding } from '../types';
import type { EngagementSegment } from '../engagementTypes';

const event: CriticalEvent = {
  id: 'critical:down-cluster:1',
  timestampMs: 42_000,
  fightId: 'fight-1',
  category: 'defense',
  kind: 'mass-down',
  summary: 'Four allied downs occurred in a short window.',
  relatedEvents: ['combat:down:a', 'combat:down:b'],
  relatedPlayers: ['player:a', 'player:b'],
  confidence: 'high',
};

const segment: EngagementSegment = {
  id: 'segment:fight-1:0',
  fightId: 'fight-1',
  index: 0,
  start: {
    timestampMs: 35_000,
    reason: 'critical-event-cluster',
    evidence: [],
  },
  end: {
    timestampMs: 55_000,
    reason: 'combat-activity-end',
    evidence: [],
  },
  durationMs: 20_000,
  state: 'active',
  confidence: 'high',
  criticalEventIds: [event.id],
  combatEventIds: ['combat:down:a', 'combat:down:b'],
  participantKeys: ['player:a', 'player:b', 'player:c'],
  downs: 4,
  deaths: 1,
  evidence: [],
};

const finding: IntelligenceFinding = {
  id: 'finding:defensive-collapse:segment:fight-1:0',
  title: 'Defensive collapse',
  category: 'defense',
  severity: 'critical',
  confidence: 'strong-correlation',
  summary: 'Down pressure clustered with defensive-failure evidence.',
  evidence: [
    {
      statement: 'The same down events support this finding.',
      relatedEvents: ['combat:down:a'],
      relatedPlayers: ['player:c'],
    },
  ],
  relatedEvents: ['combat:down:a'],
  relatedPlayers: ['player:a', 'player:c'],
  relatedFight: 'fight-1',
};

describe('buildEventInspection', () => {
  it('builds a bounded before/after review window around the real event timestamp', () => {
    const inspection = buildEventInspection({ event, segments: [segment], findings: [finding] });

    expect(inspection.window).toEqual({
      anchorTimestampMs: 42_000,
      startTimestampMs: 27_000,
      endTimestampMs: 57_000,
      beforeMs: 15_000,
      afterMs: 15_000,
    });
  });

  it('connects already-related segments, findings, event ids, and players without inventing metrics', () => {
    const inspection = buildEventInspection({ event, segments: [segment], findings: [finding] });

    expect(inspection.relatedSegments.map((item) => item.id)).toEqual([segment.id]);
    expect(inspection.relatedFindings.map((item) => item.id)).toEqual([finding.id]);
    expect(inspection.relatedEventIds).toEqual([
      'critical:down-cluster:1',
      'combat:down:a',
      'combat:down:b',
    ]);
    expect(inspection.relatedPlayerKeys).toEqual(['player:a', 'player:b', 'player:c']);
  });

  it('does not connect evidence from another fight', () => {
    const foreignFinding: IntelligenceFinding = { ...finding, id: 'finding:foreign', relatedFight: 'fight-2' };
    const foreignSegment: EngagementSegment = { ...segment, id: 'segment:fight-2:0', fightId: 'fight-2' };

    const inspection = buildEventInspection({
      event,
      segments: [foreignSegment],
      findings: [foreignFinding],
    });

    expect(inspection.relatedSegments).toEqual([]);
    expect(inspection.relatedFindings).toEqual([]);
    expect(inspection.relatedPlayerKeys).toEqual(['player:a', 'player:b']);
  });

  it('clamps the review window at fight-relative zero', () => {
    const earlyEvent: CriticalEvent = { ...event, timestampMs: 5_000 };
    const inspection = buildEventInspection({
      event: earlyEvent,
      segments: [],
      findings: [],
      beforeMs: 10_000,
      afterMs: 2_000,
    });

    expect(inspection.window.startTimestampMs).toBe(0);
    expect(inspection.window.endTimestampMs).toBe(7_000);
  });
});
