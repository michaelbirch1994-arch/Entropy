import { describe, it, expect } from 'vitest';
import { rechargeWindow, buildSupportOpportunities } from '../insight/supportOpportunities';
import type { ReplayEffectTrack } from '../parseReplayData';
import type { WvWReport } from '../../types/report';
const effect = (name: string, states: [number, number][]): ReplayEffectTrack => ({ id: 1, name, states, classification: 'Boon' });
describe('Support recharge evidence', () => {
  it('integrates timed alacrity changes rather than dividing by fight duration', () => {
    const result = rechargeWindow(0, 30000, 24000, [effect('Alacrity', [[0, 1], [10000, 0]]), effect('Chilled', [[0, 0]])]);
    expect(result.earliestReadyMs).toBe(21500);
    expect(result.latestReadyMs).toBe(21500);
  });
  it('treats missing effects as uncertainty and chill as increased recharge time', () => {
    expect(rechargeWindow(0, 20000, 24000, []).status).toContain('uncertain');
    const result = rechargeWindow(0, 40000, 24000, [effect('Alacrity', [[0, 0]]), effect('Chilled', [[0, 1]]), effect('Resistance', [[0, 0]])]);
    expect(result.latestReadyMs).toBe(39840);
  });
  it('preserves recorded use and only joins the matching fight and squad', () => {
    const report = { stats: {
      rotations: { skillMeta: { 1: { name: '"Stand Your Ground!"' } }, fights: [{ fightId: 'f', durationMs: 50000, players: [{ account: 'A', profession: 'Firebrand', casts: [{ skillId: 1, castTime: 0 }, { skillId: 1, castTime: 28000 }] }] }] },
      replayFights: [{ fightId: 'f', data: { players: [{ account: 'A', inSquad: true, effects: [], downIntervals: [] }, { account: 'B', inSquad: true, effects: [], downIntervals: [[30000, 40000]] }, { account: 'Enemy', inSquad: false, downIntervals: [[30000, 40000]] }] } }],
    } } as unknown as WvWReport;
    const before = JSON.stringify(report);
    const records = buildSupportOpportunities(report, 'A');
    expect(records).toHaveLength(2);
    expect(records[1].data).toMatchObject({ teammate: 'B', recordedUsesInWindow: 1, lastCastMs: 28000, actualAvailability: 'Unknown', referenceRecharge: { status: 'Recharge incomplete in reference scenarios' } });
    expect(JSON.stringify(report)).toBe(before);
    expect(buildSupportOpportunities(report, 'B')).toHaveLength(1);
  });
});
