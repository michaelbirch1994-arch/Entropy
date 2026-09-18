import { expect, it } from 'vitest';
import type { Gw2Skill } from '../../types/buildEditor';
import { playerSkillState } from '../insight/playerSkillState';
const skill = { id: 1, type: 'Utility', facts: [{ type: 'Recharge', value: 20 }] } as Gw2Skill;
const casts = [{ skillId: 1, castTime: 1000, duration: 0 }, { skillId: 1, castTime: 30000, duration: 0 }];
it('uses only prior casts and gives an explicit base scenario', () => {
  expect(playerSkillState(casts, 1, 5000, skill)).toMatchObject({ lastUseMs: 1000, referenceEndMs: 21000, remainingMs: 16000, recordedUses: 1 });
  expect(playerSkillState(casts, 1, 21000, skill).status).toBe('base-elapsed');
});
it('does not infer pre-log availability or use mismatched facts', () => {
  expect(playerSkillState(casts, 1, 0, skill).status).toBe('unknown');
  expect(playerSkillState(casts, 1, 5000, { ...skill, id: 2 }).status).toBe('unknown');
});
it('keeps ammo and special access unmodeled while allowing documented weapon and flip-skill recharge', () => {
  expect(playerSkillState(casts, 1, 5000, { ...skill, flip_skill: 2 })).toMatchObject({ status: 'base-recharging', scenarioRemainingMs: 16000 });
  expect(playerSkillState(casts, 1, 5000, { ...skill, facts: [...skill.facts!, { type: 'Number', text: 'Ammo Count', value: 2 }] }).status).toBe('unknown');
  expect(playerSkillState(casts, 1, 5000, { ...skill, type: 'Weapon' })).toMatchObject({ status: 'base-recharging', scenarioRemainingMs: 16000 });
});
it('deduplicates and resets the reference anchor at the latest use', () => {
  expect(playerSkillState([...casts, casts[0]], 1, 31000, skill)).toMatchObject({ recordedUses: 2, referenceEndMs: 50000 });
});
it('suspends the scenario on a shorter recorded gap without using future casts', () => {
  const rapid = [{ skillId: 1, castTime: 1000, duration: 0 }, { skillId: 1, castTime: 6000, duration: 0 }];
  expect(playerSkillState(rapid, 1, 5000, skill).status).toBe('base-recharging');
  expect(playerSkillState(rapid, 1, 6000, skill)).toMatchObject({ status: 'reference-conflict', referenceEndMs: null, remainingMs: null,
    scenarioEndMs: 26000, scenarioRemainingMs: 20000, shortGapCount: 1,
    recentShortGaps: [{ startMs: 1000, endMs: 6000, gapMs: 5000, shorterByMs: 15000 }] });
});
it('allows an exact base-recharge gap and ignores duplicate timestamps', () => {
  const uses = [{ skillId: 1, castTime: 1000, duration: 0 }, { skillId: 1, castTime: 21000, duration: 0 }];
  expect(playerSkillState([...uses, uses[0]], 1, 21000, skill).shortGapCount).toBe(0);
});
it('rejects nonfinite times and does not expose mismatched recharge facts', () => {
  expect(playerSkillState(casts, 1, Infinity, skill)).toMatchObject({ status: 'unknown', recordedUses: 0 });
  expect(playerSkillState(casts, 1, 5000, { ...skill, id: 2 }).baseMs).toBeNull();
});

it('uses recorded alacrity to explain a cast that is early against the API base', () => {
  const rapid = [{ skillId: 1, castTime: 0, duration: 0 }, { skillId: 1, castTime: 18_000, duration: 0 }];
  const effects = [
    { id: 1, name: 'Alacrity', classification: 'Boon' as const, states: [[0, 1], [10_000, 0]] as [number, number][] },
    { id: 2, name: 'Chilled', classification: 'Condition' as const, states: [[0, 0]] as [number, number][] },
    { id: 3, name: 'Resistance', classification: 'Boon' as const, states: [[0, 0]] as [number, number][] },
  ];
  expect(playerSkillState(rapid, 1, 18_000, skill, { effects, effectTimelineComplete: true })).toMatchObject({
    shortGapCount: 0,
    status: 'adjusted-recharging',
  });
  expect(playerSkillState(rapid, 1, 17_000, skill, { effects, effectTimelineComplete: true })).toMatchObject({
    status: 'adjusted-recharging',
    remainingMs: 500,
  });
});
