import { describe, expect, it } from 'vitest';
import type { Gw2Skill } from '../../types/buildEditor';
import type { ReplayEffectTrack } from '../parseReplayData';
import { assessCooldownInterval } from '../insight/cooldownModifiers';

const effect = (name: string, states: [number, number][]): ReplayEffectTrack => ({ id: 1, name, states, classification: name === 'Chilled' ? 'Condition' : 'Boon' });
const skill = (partial: Partial<Gw2Skill> = {}): Gw2Skill => ({ id: 1, name: 'Test skill', type: 'Utility', slot: 'Utility', facts: [], ...partial });
const context = (partial = {}) => ({ casts: [], skillId: 1, skill: skill(), profession: 'Guardian', skillMeta: {}, effects: [], effectTimelineComplete: true, ...partial });

describe('cooldown modifier assessment', () => {
  it('integrates timestamped alacrity as recharge progress', () => {
    const effects = [effect('Alacrity', [[0, 1], [10_000, 0]]), effect('Chilled', [[0, 0]]), effect('Resistance', [[0, 0]])];
    expect(assessCooldownInterval(0, 17_000, 20_000, context({ effects }))).toMatchObject({
      status: 'recharging', minimumProgressMs: 19_500, maximumProgressMs: 19_500, remainingMinMs: 500, remainingMaxMs: 500,
    });
    expect(assessCooldownInterval(0, 18_000, 20_000, context({ effects }))).toMatchObject({
      status: 'ready', remainingMaxMs: 0, earliestReadyMs: 17_500, latestReadyMs: 17_500,
    });
  });

  it('models Chill conservatively and exposes overlap as a range', () => {
    const chilled = assessCooldownInterval(0, 10_000, 10_000, context({ effects: [effect('Chilled', [[0, 1]]), effect('Alacrity', [[0, 0]]), effect('Resistance', [[0, 0]])] }));
    expect(chilled.status).toBe('recharging');
    expect(chilled.maximumProgressMs).toBeCloseTo(6024.096, 2);
    const overlap = assessCooldownInterval(0, 8_000, 8_000, context({ effects: [effect('Chilled', [[0, 1]]), effect('Alacrity', [[0, 1]]), effect('Resistance', [[0, 0]])] }));
    expect(overlap).toMatchObject({ status: 'uncertain', minimumProgressMs: expect.any(Number), maximumProgressMs: 8_000 });
    expect(overlap.coveragePct).toBeLessThan(84);
  });

  it('separates effective Chill from Chill suppressed by Resistance', () => {
    const result = assessCooldownInterval(0, 10_000, 20_000, context({ effects: [
      effect('Chilled', [[0, 1], [10_000, 0]]),
      effect('Resistance', [[0, 1], [4_000, 0]]),
      effect('Alacrity', [[0, 0]]),
    ] }));
    expect(result.minimumProgressMs).toBeCloseTo(7_614.458, 2);
    expect(result.modifiers).toContainEqual(expect.objectContaining({
      name: 'Chilled',
      detail: '10.0s recorded; 4.0s suppressed by Resistance.',
      impact: '0.602x for 6.0s',
    }));
  });

  it('uses the mandatory Chronomancer trait to strengthen WvW Alacrity', () => {
    const effects = [effect('Alacrity', [[0, 1], [10_000, 0]]), effect('Chilled', [[0, 0]]), effect('Resistance', [[0, 0]])];
    const result = assessCooldownInterval(0, 10_000, 20_000, context({ profession: 'Chronomancer', gameMode: 'wvw', effects }));
    expect(result.minimumProgressMs).toBe(13_300);
    expect(result.modifiers).toContainEqual(expect.objectContaining({
      name: 'Time Marches On', applied: true, certaintyPct: 99, impact: '1.33x while Alacrity is active',
    }));
  });

  it('applies a verified scoped trait to the base reference', () => {
    const attunement = skill({ id: 5494, name: 'Air Attunement', type: 'Profession', slot: 'Profession_3', professions: ['Elementalist'] });
    const result = assessCooldownInterval(0, 1_000, 10_000, context({ skillId: 5494, skill: attunement, profession: 'Weaver', verifiedTraitIds: [2004] }));
    expect(result.adjustedBaseMs).toBe(8_500);
    expect(result.modifiers).toContainEqual(expect.objectContaining({ name: 'Elemental Enchantment', applied: true, impact: '-15% base recharge' }));
  });

  it('uses current API scopes and does not grant Ambidexterity recharge to mace', () => {
    const dagger = skill({ id: 2, name: 'Dagger skill', type: 'Weapon', slot: 'Weapon_2', weapon_type: 'Dagger' });
    const mace = skill({ id: 3, name: 'Mace skill', type: 'Weapon', slot: 'Weapon_2', weapon_type: 'Mace' });
    expect(assessCooldownInterval(0, 1_000, 10_000, context({ skillId: dagger.id, skill: dagger, profession: 'Druid', verifiedTraitIds: [1101] })).adjustedBaseMs).toBe(8_000);
    expect(assessCooldownInterval(0, 1_000, 10_000, context({ skillId: mace.id, skill: mace, profession: 'Druid', verifiedTraitIds: [1101] })).adjustedBaseMs).toBe(10_000);
  });

  it('applies Flow State to dual attacks without stacking attunement weapon traits', () => {
    const dual = skill({ id: 5, name: 'Plasma Burst', type: 'Weapon', slot: 'Weapon_3', attunement: 'Fire', dual_attunement: 'Air' });
    const result = assessCooldownInterval(0, 1_000, 10_000, context({
      skillId: dual.id, skill: dual, profession: 'Weaver', verifiedTraitIds: [2138, 319],
    }));
    expect(result.adjustedBaseMs).toBe(8_000);
    expect(result.modifiers).toContainEqual(expect.objectContaining({ name: 'Flow State', applied: true }));
    expect(result.modifiers).not.toContainEqual(expect.objectContaining({ name: "Pyromancer's Training", applied: true }));
  });

  it('surfaces verified trigger traits as bounded candidates without inventing their trigger', () => {
    const elite = skill({ id: 4, name: 'Elite tool', type: 'Elite', slot: 'Elite' });
    const result = assessCooldownInterval(0, 5_000, 20_000, context({ skillId: elite.id, skill: elite, profession: 'Scrapper', verifiedTraitIds: [531] }));
    expect(result.modifiers).toContainEqual(expect.objectContaining({
      name: 'Power Wrench', applied: false, certaintyPct: 66, impact: '0-3s per qualifying dodge',
    }));
  });

  it('treats only a completed Renewed Focus channel as a Guardian profession reset', () => {
    const virtue = skill({ id: 44364, name: 'Tome of Justice', type: 'Profession', slot: 'Profession_1', professions: ['Guardian'] });
    const completed = assessCooldownInterval(0, 9_000, 30_000, context({ skillId: virtue.id, skill: virtue, profession: 'Firebrand',
      casts: [{ skillId: 9154, castTime: 5_000, duration: 3_000 }], skillMeta: { 9154: { name: 'Renewed Focus' } } }));
    expect(completed.status).toBe('ready');
    expect(completed.modifiers).toContainEqual(expect.objectContaining({ name: 'Renewed Focus', applied: true }));
    const canceled = assessCooldownInterval(0, 9_000, 30_000, context({ skillId: virtue.id, skill: virtue, profession: 'Firebrand',
      casts: [{ skillId: 9154, castTime: 5_000, duration: 1_000 }], skillMeta: { 9154: { name: 'Renewed Focus' } } }));
    expect(canceled.status).toBe('recharging');
  });

  it('quantifies unverified trigger candidates without applying them', () => {
    const air = skill({ id: 5494, name: 'Air Attunement', type: 'Profession', slot: 'Profession_3' });
    const freshAir = assessCooldownInterval(0, 2_000, 10_000, context({ skillId: air.id, skill: air, profession: 'Tempest' }));
    expect(freshAir.modifiers).toContainEqual(expect.objectContaining({ name: 'Fresh Air', applied: false, impact: 'up to a full reset' }));

    const shroud = skill({ id: 30825, name: 'Infusing Terror', type: 'Profession', slot: 'Profession_3' });
    const reaper = assessCooldownInterval(0, 3_000, 25_000, context({ skillId: shroud.id, skill: shroud, profession: 'Reaper',
      casts: [{ skillId: 30278, castTime: 1_000, duration: 500 }], skillMeta: { 30278: { name: 'Life Reap' } } }));
    expect(reaper.modifiers).toContainEqual(expect.objectContaining({ name: "Reaper's Onslaught", applied: false, impact: '0-1s possible recharge' }));
  });

  it('catalogs modern dodge, virtue, and elite-specialization reset candidates', () => {
    const toolBelt = skill({ id: 6, name: 'Incendiary Ammo', type: 'Profession', slot: 'Profession_2', categories: ['Toolbelt'] });
    const engineerResult = assessCooldownInterval(0, 3_000, 20_000, context({
      skillId: toolBelt.id, skill: toolBelt, profession: 'Scrapper', verifiedTraitIds: [523],
    }));
    expect(engineerResult.modifiers).toContainEqual(expect.objectContaining({ name: 'Adrenal Implant', applied: false, certaintyPct: 66 }));

    const courage = skill({ id: 42259, name: 'Tome of Courage', type: 'Profession', slot: 'Profession_3' });
    const guardianResult = assessCooldownInterval(0, 3_000, 30_000, context({
      skillId: courage.id, skill: courage, profession: 'Firebrand', verifiedTraitIds: [589],
    }));
    expect(guardianResult.modifiers).toContainEqual(expect.objectContaining({ name: 'Tenacious Defense', applied: false, impact: '0-1s per qualifying Aegis block' }));

    const bluster = skill({ id: 7, name: 'Bluster', type: 'Weapon', slot: 'Weapon_4' });
    const galeshotResult = assessCooldownInterval(0, 3_000, 20_000, context({
      skillId: bluster.id, skill: bluster, profession: 'Galeshot', verifiedTraitIds: [2425],
      casts: [{ skillId: 8, castTime: 2_000, duration: 400 }], skillMeta: { 8: { name: "Quarry's Peril" } },
    }));
    expect(galeshotResult.modifiers).toContainEqual(expect.objectContaining({ name: 'Cloudburst', applied: false, certaintyPct: 88 }));
  });

  it('does not apply historical Martial Cadence cooldown behavior', () => {
    const result = assessCooldownInterval(0, 5_000, 20_000, context({ profession: 'Warrior' }));
    expect(result.modifiers).toContainEqual(expect.objectContaining({ name: 'Martial Cadence', kind: 'historical', applied: false, certaintyPct: 100 }));
    expect(result.adjustedBaseMs).toBe(20_000);
  });
});
