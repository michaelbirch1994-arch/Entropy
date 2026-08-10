import { describe, expect, it } from 'vitest';
import { synthesizeFindings } from '../intelligence/findingEngine';
import type { EngagementSegment } from '../intelligence/engagementTypes';
import type { CriticalEvent } from '../intelligence/types';

const critical = (
  kind: string,
  timestampMs: number,
  overrides: Partial<CriticalEvent> = {},
): CriticalEvent => ({
  id: `${kind}:${timestampMs}`,
  timestampMs,
  fightId: 'fight-1',
  category: kind === 'squad-separation' ? 'positioning' : 'defense',
  kind,
  summary: `${kind} at ${timestampMs}`,
  relatedEvents: [`event:${kind}:${timestampMs}`],
  relatedPlayers: ['player:Alice.1'],
  confidence: 'high',
  ...overrides,
});

const segment = (
  criticalEventIds: string[],
  overrides: Partial<EngagementSegment> = {},
): EngagementSegment => ({
  id: 'engagement:fight-1:0:1000-5000',
  fightId: 'fight-1',
  index: 0,
  start: { timestampMs: 1000, reason: 'fight-boundary', evidence: [] },
  end: { timestampMs: 5000, reason: 'combat-activity-end', evidence: [] },
  durationMs: 4000,
  state: 'active',
  confidence: 'high',
  criticalEventIds,
  combatEventIds: ['combat:1'],
  participantKeys: ['player:Alice.1'],
  downs: 0,
  deaths: 0,
  evidence: [],
  ...overrides,
});

describe('synthesizeFindings', () => {
  it('emits a defensive collapse finding', () => {
    const events = [critical('defensive-failure', 1000), critical('mass-down', 2000)];
    const findings = synthesizeFindings({
      fightId: 'fight-1',
      segments: [segment(events.map((event) => event.id), { downs: 3 })],
      criticalEvents: events,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Defensive collapse');
    expect(findings[0].category).toBe('defense');
    expect(findings[0].evidence).toHaveLength(1);
    expect(findings[0].recommendation).toBeUndefined();
  });

  it('emits a positioning collapse finding', () => {
    const events = [critical('squad-separation', 1000), critical('failed-recovery', 3000)];
    const findings = synthesizeFindings({
      fightId: 'fight-1',
      segments: [segment(events.map((event) => event.id), { downs: 1, deaths: 1 })],
      criticalEvents: events,
    });

    expect(findings.some((finding) => finding.title === 'Positioning collapse')).toBe(true);
  });

  it('emits a spike collapse finding', () => {
    const events = [critical('enemy-spike', 1000), critical('mass-down', 3000)];
    const findings = synthesizeFindings({
      fightId: 'fight-1',
      segments: [segment(events.map((event) => event.id), { downs: 3 })],
      criticalEvents: events,
    });

    expect(findings.some((finding) => finding.title === 'Spike collapse')).toBe(true);
  });

  it('emits a failed recovery cluster finding', () => {
    const events = [critical('failed-recovery', 1000)];
    const findings = synthesizeFindings({
      fightId: 'fight-1',
      segments: [segment(events.map((event) => event.id), { deaths: 1 })],
      criticalEvents: events,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Failed recovery cluster');
  });

  it('emits no finding for a segment with no critical events', () => {
    const findings = synthesizeFindings({
      fightId: 'fight-1',
      segments: [segment([])],
      criticalEvents: [],
    });

    expect(findings).toEqual([]);
  });

  it('does not duplicate the same finding type for one segment', () => {
    const events = [
      critical('defensive-failure', 1000),
      critical('defensive-failure', 1500),
      critical('mass-down', 2000),
    ];

    const findings = synthesizeFindings({
      fightId: 'fight-1',
      segments: [segment(events.map((event) => event.id), { downs: 3 })],
      criticalEvents: events,
    });

    expect(findings.filter((finding) => finding.title === 'Defensive collapse')).toHaveLength(1);
  });

  it('preserves related event ids from segment and critical events', () => {
    const events = [critical('enemy-spike', 1000), critical('mass-down', 2000)];
    const findings = synthesizeFindings({
      fightId: 'fight-1',
      segments: [segment(events.map((event) => event.id), { combatEventIds: ['combat:a'], downs: 3 })],
      criticalEvents: events,
    });

    expect(findings[0].relatedEvents).toContain('combat:a');
    expect(findings[0].relatedEvents).toContain('event:enemy-spike:1000');
  });

  it('preserves related player keys', () => {
    const events = [critical('enemy-spike', 1000), critical('mass-down', 2000)];
    const findings = synthesizeFindings({
      fightId: 'fight-1',
      segments: [segment(events.map((event) => event.id), { participantKeys: ['player:Bob.1'], downs: 3 })],
      criticalEvents: events,
    });

    expect(findings[0].relatedPlayers).toContain('player:Bob.1');
    expect(findings[0].relatedPlayers).toContain('player:Alice.1');
  });

  it('uses correlation confidence only, not likely-causal', () => {
    const events = [critical('enemy-spike', 1000), critical('mass-down', 2000)];
    const findings = synthesizeFindings({
      fightId: 'fight-1',
      segments: [segment(events.map((event) => event.id), { downs: 3 })],
      criticalEvents: events,
    });

    expect(findings[0].confidence).not.toBe('likely-causal');
  });
});
