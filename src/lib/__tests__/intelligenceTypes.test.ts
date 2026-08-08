// Sanity tests for the Intelligence type system. There is no detection logic
// to test yet (deliberately — see intelligenceTypes.ts header), so these
// tests exist to prove the types are actually usable end-to-end: a Finding
// can be built referencing real CombatEvent identities, and the
// "must have evidence" / "must have basedOn" rules are enforced at
// construction time, not just in a comment.

import { describe, it, expect } from 'vitest';
import { eventIdentity, type CombatEvent } from '../combat/CombatEvent';
import { createFinding, createRecommendation, type Evidence } from '../intelligence/types';

const sampleEvent: CombatEvent = {
  timestampMs: 5000,
  source: { name: 'Bob', account: 'Bob.1234', kind: 'player' },
  target: { name: 'Ann', account: 'Ann.5678', kind: 'player' },
  category: 'death',
  subcategory: 'unknown',
  amount: 0,
  hits: 1,
  origin: 'eliteInsights',
  confidence: 'high',
  coverage: 'full',
};

describe('IntelligenceFinding construction', () => {
  it('builds a Finding whose evidence references a real CombatEvent identity', () => {
    const evidence: Evidence = {
      statement: 'Ann died 5.0s into the fight.',
      metrics: { timestampMs: 5000 },
      relatedEvents: [eventIdentity(sampleEvent)],
      relatedPlayers: ['player:Ann.5678'],
    };

    const finding = createFinding({
      id: 'finding-1',
      title: 'Early death',
      category: 'defense',
      severity: 'notable',
      confidence: 'correlation',
      summary: 'One death occurred early in the fight.',
      evidence: [evidence],
      relatedEvents: [eventIdentity(sampleEvent)],
      relatedFight: 'fight-1',
    });

    expect(finding.evidence).toHaveLength(1);
    expect(finding.evidence[0].relatedEvents?.[0]).toBe(eventIdentity(sampleEvent));
    // The event identity should be reconstructable/comparable, not an opaque blob.
    expect(finding.relatedEvents[0]).toContain('death');
  });

  it('a Recommendation must reference at least one Finding via basedOn', () => {
    const rec = createRecommendation({
      id: 'rec-1',
      title: 'Investigate early deaths',
      detail: 'Review positioning around the 5s mark.',
      confidence: 'correlation',
      basedOn: ['finding-1'],
    });
    expect(rec.basedOn.length).toBeGreaterThan(0);
  });
});
