import { describe, expect, it } from 'vitest';
import { skillCastTiming } from '../insight/skillCastTiming';
import type { WvWReport } from '../../types/report';
import type { Gw2Skill } from '../../types/buildEditor';
const skill = { id: 1, name: 'Test skill', type: 'Utility', facts: [{ type: 'Recharge', value: 24 }] } as Gw2Skill;
const report = { stats: { rotations: { fights: [
  { fightId: 'one', durationMs: 60000, players: [{ account: 'A', casts: [0, 30000, 30000, -1, 90000].map(castTime => ({ skillId: 1, castTime })) }] },
  { fightId: 'two', durationMs: 10000, players: [{ account: 'A', casts: [{ skillId: 1, castTime: 1000 }] }] },
] } } } as unknown as WvWReport;
describe('Skill cast timing', () => {
  it('keeps fights separate, removes duplicate timestamps, and never invents trailing uses', () => {
    const before = JSON.stringify(report);
    const result = skillCastTiming(report, 'A', skill);
    expect(result.includedFights[0]).toMatchObject({ recordedCasts: 2, totalInterCastGaps: 1, longestRecordedGaps: [{ previousCastMs: 0, nextCastMs: 30000, gapMs: 30000, survivalOverlap: null }] });
    expect(result.includedFights[1].longestRecordedGaps).toEqual([]);
    expect(JSON.stringify(report)).toBe(before);
    expect(skillCastTiming(report, 'B', skill).includedFights).toEqual([]);
  });
  it('suppresses ordinary cooldown comparisons for bundles and ammunition', () => {
    expect(skillCastTiming(report, 'A', { ...skill, type: 'Bundle' }).includedFights[0].longestRecordedGaps[0].referenceRecharge).toBeNull();
    expect(skillCastTiming(report, 'A', { ...skill, facts: [...skill.facts!, { type: 'Recharge', text: 'Ammo Recharge', value: 24 }] }).includedFights[0].longestRecordedGaps[0].referenceRecharge).toBeNull();
  });
});
