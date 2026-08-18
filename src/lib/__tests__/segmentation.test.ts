import { describe, expect, it } from 'vitest';
import { segmentEngagements, summarizeEngagement } from '../intelligence/segmentation';
import type { CombatEvent } from '../combat/CombatEvent';
import type { CriticalEvent } from '../intelligence/types';

const combat = (
  timestampMs: number | null,
  category: CombatEvent['category'] = 'damage',
  sourceName = 'Alice',
  targetName = 'Enemy',
  overrides: Partial<CombatEvent> = {},
): CombatEvent => ({
  timestampMs,
  source: { name: sourceName, account: `${sourceName}.1`, kind: 'player', side: 'friendly' },
  target: { name: targetName, kind: 'unknown', side: 'enemy' },
  category,
  subcategory: 'unknown',
  amount: category === 'damage' ? 100 : 0,
  hits: 1,
  origin: 'eliteInsights',
  confidence: 'high',
  coverage: 'full',
  ...overrides,
});

const critical = (
  timestampMs: number,
  kind: string,
  relatedPlayers: string[] = ['player:Alice.1'],
  overrides: Partial<CriticalEvent> = {},
): CriticalEvent => ({
  id: `${kind}:${timestampMs}`,
  timestampMs,
  fightId: 'fight-1',
  category: 'defense',
  kind,
  summary: `${kind} at ${timestampMs}`,
  relatedEvents: [],
  relatedPlayers,
  confidence: 'high',
  ...overrides,
});

describe('segmentEngagements', () => {
  it('groups nearby timestamped combat events into one engagement', () => {
    const segments = segmentEngagements({
      fightId: 'fight-1',
      combatEvents: [combat(1000), combat(2000), combat(3000)],
      criticalEvents: [],
      config: { inactivityGapMs: 15000, minimumEngagementMs: 0 },
    });

    expect(segments).toHaveLength(1);
    expect(segments[0].start.timestampMs).toBe(1000);
    expect(segments[0].end.timestampMs).toBe(3000);
    expect(segments[0].combatEventIds).toHaveLength(3);
  });

  it('splits engagements across a clear inactivity gap', () => {
    const segments = segmentEngagements({
      fightId: 'fight-1',
      combatEvents: [combat(1000), combat(2000), combat(25000), combat(26000)],
      criticalEvents: [],
      config: { inactivityGapMs: 15000, minimumEngagementMs: 0 },
    });

    expect(segments).toHaveLength(2);
    expect(segments[0].start.timestampMs).toBe(1000);
    expect(segments[1].start.timestampMs).toBe(25000);
  });

  it('does not split on a short lull below the inactivity threshold', () => {
    const segments = segmentEngagements({
      fightId: 'fight-1',
      combatEvents: [combat(1000), combat(9000), combat(14000)],
      criticalEvents: [],
      config: { inactivityGapMs: 15000, minimumEngagementMs: 0 },
    });

    expect(segments).toHaveLength(1);
  });

  it('includes critical events inside the matching engagement', () => {
    const segments = segmentEngagements({
      fightId: 'fight-1',
      combatEvents: [combat(1000), combat(3000, 'down'), combat(4500, 'death')],
      criticalEvents: [critical(3200, 'mass-down'), critical(4000, 'failed-recovery')],
      config: { inactivityGapMs: 15000, minimumEngagementMs: 0 },
    });

    expect(segments).toHaveLength(1);
    expect(segments[0].criticalEventIds).toEqual(['mass-down:3200', 'failed-recovery:4000']);
    expect(segments[0].downs).toBe(1);
    expect(segments[0].deaths).toBe(1);
    expect(segments[0].evidence.some((e) => e.statement.includes('critical event'))).toBe(true);
  });

  it('ignores phase-aggregate combat events with null timestamps', () => {
    const segments = segmentEngagements({
      fightId: 'fight-1',
      combatEvents: [combat(null), combat(1000)],
      criticalEvents: [],
      config: { inactivityGapMs: 15000, minimumEngagementMs: 0 },
    });

    expect(segments).toHaveLength(1);
    expect(segments[0].combatEventIds).toHaveLength(1);
  });

  it('keeps participant identities from combat and critical events', () => {
    const segments = segmentEngagements({
      fightId: 'fight-1',
      combatEvents: [combat(1000, 'damage', 'Alice'), combat(2000, 'damage', 'Bob')],
      criticalEvents: [critical(2500, 'squad-separation', ['player:Carol.1'])],
      config: { inactivityGapMs: 15000, minimumEngagementMs: 0 },
    });

    expect(segments[0].participantKeys).toContain('player:Alice.1');
    expect(segments[0].participantKeys).toContain('player:Bob.1');
    expect(segments[0].participantKeys).toContain('player:Carol.1');
  });

  it('degrades confidence to the weakest contained signal', () => {
    const segments = segmentEngagements({
      fightId: 'fight-1',
      combatEvents: [combat(1000), combat(2000, 'damage', 'Bob', 'Enemy', { confidence: 'medium' })],
      criticalEvents: [critical(3000, 'enemy-spike')],
      config: { inactivityGapMs: 15000, minimumEngagementMs: 0 },
    });

    expect(segments[0].confidence).toBe('medium');
  });

  it('returns [] when there are no timestamped signals', () => {
    const segments = segmentEngagements({
      fightId: 'fight-1',
      combatEvents: [combat(null)],
      criticalEvents: [],
    });

    expect(segments).toEqual([]);
  });

  it('provides a compact text summary for debug surfaces', () => {
    const [segment] = segmentEngagements({
      fightId: 'fight-1',
      combatEvents: [combat(1000), combat(3000, 'down')],
      criticalEvents: [critical(2500, 'mass-down')],
      config: { inactivityGapMs: 15000, minimumEngagementMs: 0 },
    });

    expect(summarizeEngagement(segment)).toMatch(/Engagement 1/);
    expect(summarizeEngagement(segment)).toMatch(/1 critical events/);
    expect(summarizeEngagement(segment)).toMatch(/1 downs/);
  });
});
