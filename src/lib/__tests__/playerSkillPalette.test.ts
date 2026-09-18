import { expect, it } from 'vitest';
import type { Gw2Skill } from '../../types/buildEditor';
import { buildPlayerSkillPalette, supplementalPlayerSkillIds } from '../insight/playerSkillPalette';

const apiSkill = (id: number, name: string, slot: Gw2Skill['slot'], extra: Partial<Gw2Skill> = {}): Gw2Skill => ({ id, name, slot, ...extra });

it('builds all three Firebrand tome replacement bars from the wiki-backed catalog', () => {
  const references = Object.fromEntries([
    apiSkill(44364, 'Tome of Justice', 'Profession_1', { type: 'Profession' }),
    apiSkill(41780, 'Tome of Resolve', 'Profession_2', { type: 'Profession' }),
    apiSkill(42259, 'Tome of Courage', 'Profession_3', { type: 'Profession' }),
  ].map((skill) => [skill.id, skill]));

  const palette = buildPlayerSkillPalette('Firebrand', [{ skillId: 40988, castTime: 1000, duration: 0 }], references, 2000);

  expect(palette.mechanics.map(({ id }) => id)).toEqual([44364, 41780, 42259]);
  expect(palette.bars.map(({ label }) => label)).toEqual(['Observed weapon bar', 'Tome of Justice', 'Tome of Resolve', 'Tome of Courage']);
  expect(palette.bars.find(({ key }) => key === 'courage')?.slots.map((entry) => entry?.id)).toEqual([42986, 41968, 41836, 40988, 44455]);
  expect(palette.bars.find(({ key }) => key === 'courage')?.source).toBe('wiki-wvw');
});

it('uses API slot metadata for the Druid Celestial Avatar replacement bar', () => {
  const ids = [31796, 31406, 31318, 31894, 31503];
  const references = Object.fromEntries(ids.map((id, index) => [id, apiSkill(id, `Avatar ${index + 1}`, `Weapon_${index + 1}`, { type: 'Weapon', categories: ['CelestialAvatar'] })]));
  const palette = buildPlayerSkillPalette('Druid', [{ skillId: 31318, castTime: 5000, duration: 0 }], references, 6000);

  expect(supplementalPlayerSkillIds('Druid')).toEqual([31869, ...ids]);
  expect(palette.bars.find(({ key }) => key === 'celestial-avatar')?.slots.map((entry) => entry?.id)).toEqual(ids);
  expect(palette.bars.find(({ key }) => key === 'celestial-avatar')?.source).toBe('api');
});

it('keeps an uncast documented candidate visible without claiming a recorded use', () => {
  const reference = apiSkill(9153, '"Stand Your Ground!"', 'Utility', { type: 'Utility' });
  const palette = buildPlayerSkillPalette('Firebrand', [], { [reference.id]: reference }, 12000, reference.id);
  const candidate = palette.additional.find(({ id }) => id === reference.id);

  expect(candidate).toMatchObject({ id: 9153, source: 'api', uses: 0, lastUseMs: null });
  expect(palette.utilitySlots.every((entry) => entry === null)).toBe(true);

  const offlineCandidate = buildPlayerSkillPalette('Firebrand', [], {}, 12000, reference.id).additional.find(({ id }) => id === reference.id);
  expect(offlineCandidate).toMatchObject({ id: 9153, source: 'documented', uses: 0, lastUseMs: null });
});
