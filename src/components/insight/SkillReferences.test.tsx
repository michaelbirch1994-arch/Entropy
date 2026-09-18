import { describe, it, expect } from 'vitest';
import { evidenceSkillIds } from './SkillReferences';
describe('Evidence skill ID selection', () => {
  it('uses cast skill IDs and ignores unrelated buff and trait IDs', () => {
    expect(evidenceSkillIds({ id: 999, effects: [{ id: 123 }], skills: [{ id: 5516 }, { id: '5517' }], nearbyCasts: [{ skillId: 5516 }], hits: [{ id: 888, isIndirect: true }] })).toEqual([5516, 5517]);
  });
  it('rejects invalid IDs and limits API reference volume', () => {
    expect(evidenceSkillIds({ skillId: -1, skills: [{ id: 's5516' }, { id: NaN }] })).toEqual([]);
    expect(evidenceSkillIds({ skills: Array.from({ length: 25 }, (_, i) => ({ id: i + 1 })) })).toHaveLength(20);
  });
});
