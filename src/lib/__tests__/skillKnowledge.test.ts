import { describe, it, expect } from 'vitest';
import { investigationSkillIds, skillKnowledgeRecord } from '../insight/skillKnowledge';
import type { WvWReport } from '../../types/report';
import type { Gw2Skill } from '../../types/buildEditor';
describe('Investigation skill knowledge', () => {
  it('selects only this player recorded IDs and ignores invalid IDs', () => {
    const report = { stats: { rotations: { fights: [{ players: [{ account: 'A', casts: [{ skillId: 5517 }, { skillId: 5516 }, { skillId: 5517 }, { skillId: -1 }] }, { account: 'B', casts: [{ skillId: 999 }] }] }] } } } as unknown as WvWReport;
    expect(investigationSkillIds(report, 'A')).toEqual([5517, 5516]);
  });
  it('keeps missing skills unresolved and preserves state dependencies', () => {
    const record = skillKnowledgeRecord([5516, 5517], [{ id: 5516, name: 'Conjure', slot: 'Elite', bundle_skills: [5517] } as Gw2Skill]);
    expect(record.data).toMatchObject({ unresolvedSkillIds: [5517], includedSkills: [{ bundleSkillIds: [5517] }] });
    expect(record.id).toBe('K1');
  });
  it('bounds reference payloads even with large API facts', () => {
    const record = skillKnowledgeRecord([1], [{ id: 1, name: 'Huge', facts: [{ text: 'x'.repeat(30000) }] } as Gw2Skill]);
    expect(new TextEncoder().encode(JSON.stringify(record)).length).toBeLessThan(20000);
    expect(record.data).toMatchObject({ unresolvedSkillIds: [1] });
  });
});
