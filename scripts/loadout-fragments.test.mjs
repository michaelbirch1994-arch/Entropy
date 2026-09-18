import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EQUIPMENT_SLOTS, LOADOUT_FIELDS } from '../src/lib/insight/loadoutSnapshot.ts';
import { fragmentLoadout, reassembleLoadout, reassembleCompanion } from './companion-fragments.mjs';

const identity = { sessionId: 'synthetic-session', snapshotId: 'baseline-1', account: 'Fixture.1234' };
const fixture = () => ({schemaVersion:2,kind:'loadout-baseline',...identity,collectorVersion:'synthetic',gameBuild:1,mode:'wvw',
  clock:{basis:'session-relative',observedMs:1000,uncertaintyMs:25},
  fields: Object.fromEntries(LOADOUT_FIELDS.map(key => [key, {state:'unknown'}])),
  equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(key => [key, {state:'unknown'}])),
});
test('round trips slot-specific equipment and declared skill evidence', () => {
  const r = fixture();
  r.fields.healSkill = {state:'value',source:'player-provided',ids:[123]};
  r.equipment.weapon1Main = {state:'value',source:'player-provided',item:{namespace:'gw2:item',id:456},
    stats:{state:'value',source:'player-provided',references:[{namespace:'gw2:itemstat',id:789}]},upgrades:{state:'unknown'},infusions:{state:'unknown'}};
  const parts=fragmentLoadout(JSON.stringify(r)); assert.ok(parts.length > 1);
  assert.deepEqual(reassembleLoadout([...parts].reverse(),identity).snapshot,r);
});
test('does not mix companion recordings with loadout envelopes', () => {
  assert.throws(()=>reassembleCompanion(fragmentLoadout(JSON.stringify(fixture())),identity),/Unsupported envelope/);
});
test('rejects rewritten header identities even when payload checksum is valid', () => {
  const parts=fragmentLoadout(JSON.stringify(fixture())).map(p=>({...p,sessionId:'other'}));
  assert.throws(()=>reassembleLoadout(parts,{...identity,sessionId:'other'}),/Payload identity/);
});
test('requires the expected player and rejects another player', () => {
  const parts=fragmentLoadout(JSON.stringify(fixture()));
  assert.throws(()=>reassembleLoadout(parts,{...identity,account:''}),/Expected account/);
  assert.throws(()=>reassembleLoadout(parts,{...identity,account:'Other.1234'}),/Payload identity/);
});
test('rejects partial equipment payload instead of publishing a partial baseline', () => {
  const parts=fragmentLoadout(JSON.stringify(fixture()));
  assert.throws(()=>reassembleLoadout(parts.slice(1),identity),/Incomplete/);
});
