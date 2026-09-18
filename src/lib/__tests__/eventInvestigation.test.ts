import { describe, it, expect } from 'vitest';
import { eventContext, eventInvestigation } from '../insight/eventInvestigation';
import type { WvWReport } from '../../types/report';
const event = { account: 'target', kind: 'down' as const, label: 'Downstate', time: 5000, end: 9000 };
function fixture() {
  return { stats: {
    fightBreakdown: [{ id: 'other' }, { id: 'fight' }], offensePlayers: [],
    rotations: { skillMeta: { 1: { name: 'Target cast' } }, fights: [{ fightId: 'fight', durationMs: 15000, players: [{ account: 'target', casts: [{ skillId: 1, castTime: 4000 }] }] }] },
    replayFights: [{ fightId: 'fight', data: { durationMs: 15000, mechanics: [], players: [
      { account: 'target', inSquad: true, downIntervals: [[5000, 9000]], deadIntervals: [], effects: [
        { id: 1, name: 'Quickness', classification: 'Boon', states: [[2000, 1], [5000, 0], [8000, 1]] },
        { id: 2, name: 'Chill', classification: 'Condition', states: [[7000, 1]] },
      ] },
      { account: 'other', inSquad: true, effects: [{ id: 1, name: 'Quickness', classification: 'Boon', states: [[0, 1]] }], downIntervals: [], deadIntervals: [] },
    ] } }],
  } } as unknown as WvWReport;
}
describe('Event-centered investigation', () => {
  it('uses target identity and covered-time denominators without changing the report', () => {
    const report = fixture(), original = JSON.stringify(report);
    const context = eventContext(report, 'fight', event)!;
    expect(context.targetAccount).toBe('target');
    expect(context.effects[0]).toMatchObject({ atEvent: 0, before: { durationMs: 5000, coveredMs: 3000, presentMs: 3000, presencePercentOfCoveredTime: 100 }, after: { coveredMs: 5000, presentMs: 2000, presencePercentOfCoveredTime: 40 } });
    expect(context.effects[1]).toMatchObject({ atEvent: null, before: { coveredMs: 0, presencePercentOfCoveredTime: null } });
    expect(context.coverage.healingTimeline).toBe(false);
    expect(context.targetEvents.every(e => e.account === 'target')).toBe(true);
    expect(JSON.stringify(report)).toBe(original);
  });
  it('links to the matching fight and preserves an empty interval as unknown', () => {
    const report = fixture();
    expect(eventInvestigation(report, 'fight', event, 'revive').replay).toEqual({ fightIndex: 1, account: 'target', timestampMs: 5000 });
    expect(eventContext(report, 'fight', { ...event, time: 0 })!.effects[0].before.presencePercentOfCoveredTime).toBeNull();
    expect(eventContext(report, 'missing', event)).toBeNull();
    expect(eventContext(report, 'fight', { ...event, time: 20000 })).toBeNull();
  });
});
