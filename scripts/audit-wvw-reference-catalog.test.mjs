import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { auditReferenceCatalog } from './audit-wvw-reference-catalog.mjs';

const catalog = JSON.parse(await readFile(new URL('../src/data/wvwReferenceCatalog.json', import.meta.url), 'utf8'));

function apiFixture() {
  return catalog.skills.map((reference) => ({
    id: reference.skillId,
    name: reference.api.name,
    flip_skill: reference.api.flipSkillId,
    facts: [
      { type: 'Recharge', value: reference.api.rechargeSeconds },
      ...(reference.api.range === undefined ? [] : [{ type: 'Range', value: reference.api.range }]),
      ...Object.entries(reference.api.distanceFacts ?? {}).map(([text, distance]) => ({ type: 'Distance', text, distance })),
      ...reference.api.buffStatuses.map((status) => ({ type: 'Buff', status })),
      ...(reference.api.stunBreak ? [{ type: 'StunBreak', value: true }] : []),
    ],
  }));
}

test('accepts the reviewed ArenaNet facts while keeping WvW splits separate', () => {
  const result = auditReferenceCatalog(catalog, apiFixture());
  assert.deepEqual(result.errors, []);
  assert.equal(result.checkedSkills, 8);
  assert.equal(result.modeSplits, 6);
});

test('fails loudly when a depended-on API fact drifts', () => {
  const fixture = apiFixture();
  fixture.find((skill) => skill.id === 9187).facts.find((fact) => fact.type === 'Recharge').value = 21;
  fixture.find((skill) => skill.id === 9153).facts = fixture.find((skill) => skill.id === 9153).facts.filter((fact) => fact.type !== 'StunBreak');
  const result = auditReferenceCatalog(catalog, fixture);
  assert.ok(result.errors.some((error) => error.includes('Purging Flames: API baseline recharge changed')));
  assert.ok(result.errors.some((error) => error.includes('Stand Your Ground!: API stun-break fact changed')));
});
