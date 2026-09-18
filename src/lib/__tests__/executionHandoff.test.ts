import { describe, expect, it } from 'vitest';
import type { WvWReport } from '../../types/report';
import { executionHandoff } from '../insight/executionHandoff';

const report = { stats: { replayFights: [{ fightId: 'f', fightName: 'Fixture', data: { durationMs: 10000, players: [
  { account: 'A', name: 'A', profession: 'Guardian', inSquad: true, effects: [{ name: 'Stability', classification: 'Boon', states: [[0, 0], [5000, 1]] }], downIntervals: [], deadIntervals: [] },
] } }], rotations: { skillMeta: {}, fights: [{ fightId: 'f', fightName: 'Fixture', durationMs: 10000, players: [{ account: 'A', casts: Array.from({ length: 150 }, (_, i) => ({ castTime: 5000 + i, skillId: 1 })) }] }] } } } as unknown as WvWReport;

describe('execution handoff', () => {
  it('preserves original evidence and adds scoped measured context', () => {
    const original = { id: 'W1', label: 'Selected event', data: { actor: 'B' } };
    const result = executionHandoff(report, original, { fightId: 'f', timeMs: 5000, radiusMs: 1000, account: 'A' });
    expect(result.id).toBe('W1');
    expect(result.data).toMatchObject({ selectedEvidence: { actor: 'B' }, executionContext: {
      account: 'A', fightId: 'f', timeMs: 5000,
      methodVersion: 'execution-handoff-v2', anchor: { kind: 'manual', method: 'user-selected-time' },
      combat: { selectedAccount: 'A', eventCount: 150, omittedEvents: 30 },
      continuity: [{ boon: 'Stability', before: { observedCoverage: 0 }, after: { observedCoverage: 1 } }, {}, {}, {}],
    } });
    expect(original.data).toEqual({ actor: 'B' });
  });
  it('does not substitute another fight for missing replay data', () => {
    const r = executionHandoff(report, { id: 'W1', label: 'Event', data: {} }, { fightId: 'missing', timeMs: 0, radiusMs: 1000, account: 'A' });
    expect(r.data).toMatchObject({ executionContext: { readiness: null, continuity: null, combat: null } });
  });
  it('never truncates or mutates oversized clicked evidence', () => {
    const original = { id: 'W1', label: 'Event', data: 'x'.repeat(65000) };
    expect(executionHandoff(report, original, { fightId: 'f', timeMs: 0, radiusMs: 1000 })).toBe(original);
  });
});
