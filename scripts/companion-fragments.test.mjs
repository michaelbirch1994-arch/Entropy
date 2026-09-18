import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fragmentCompanion, reassembleCompanion } from './companion-fragments.mjs';
const identity = { sessionId: 'synthetic-session', snapshotId: 'synthetic-snapshot' };
const fixture = () => ({ schemaVersion: 1, recordingId: 'synthetic-recording', account: 'Fixture.1234', gameBuild: 1,
  collectorVersion: 'synthetic', encounter: { logSha256: 'a'.repeat(64), durationMs: 10000 },
  clock: { basis: 'encounter-relative', uncertaintyMs: 20 }, gaps: [],
  events: Array.from({ length: 40 }, (_, sequence) => ({ sequence, timeMs: sequence * 100, source: 'player-provided', kind: 'loadout', skillIds: [1, 2, 3] })) });
const split = (recording = fixture()) => fragmentCompanion(JSON.stringify(recording), identity.sessionId, identity.snapshotId);
test('round trips multiple fragments, out of order and with identical retransmissions', () => {
  const parts = split(); assert.ok(parts.length > 1);
  assert.deepEqual(reassembleCompanion([...parts].reverse().concat(parts[0]), identity).recording, fixture());
});
test('missing fragments never produce a partial snapshot', () => {
  assert.throws(() => reassembleCompanion(split().slice(1), identity), /Incomplete/);
});
test('rejects conflicting duplicates and corruption', () => {
  const parts = split(); const changed = { ...parts[0], payload: Buffer.alloc(1024).toString('base64') };
  assert.throws(() => reassembleCompanion([...parts, changed], identity), /Conflicting duplicate/);
  assert.throws(() => reassembleCompanion([changed, ...parts.slice(1)], identity), /checksum/);
});
test('rejects cross-session and cross-snapshot mixing', () => {
  for (const key of ['sessionId', 'snapshotId']) assert.throws(() => reassembleCompanion(split(), { ...identity, [key]: 'other' }), /identity/);
});
test('rejects unknown schemas, invalid metadata and noncanonical encoding', () => {
  for (const patch of [{ version: 2 }, { count: 0 }, { index: -1 }, { byteLength: 999999 }, { payload: '!!!!' }]) {
    const parts = split(); parts[0] = { ...parts[0], ...patch };
    assert.throws(() => reassembleCompanion(parts, identity));
  }
});
test('requires explicit identity and bounds input before decoding', () => {
  assert.throws(() => reassembleCompanion(split(), {}));
  assert.throws(() => fragmentCompanion(' '.repeat(262145), 's', 'p'), /size/);
  assert.throws(() => reassembleCompanion(Array(513).fill({}), identity), /count/);
});
test('retains the existing companion schema validation', () => {
  assert.throws(() => split({ ...fixture(), schemaVersion: 99 }), /schema/);
  assert.throws(() => split({ ...fixture(), events: [{ sequence: 0, timeMs: 0, kind: 'loadout', source: 'player-provided', skillIds: [1, 1] }] }), /loadout/);
});
test('preserves UTF-8 text across byte-sized fragments', () => {
  const recording = fixture(); recording.account = '\u00e9'.repeat(100);
  assert.deepEqual(reassembleCompanion(split(recording), identity).recording, recording);
});
test('rejects contradictory fragment headers', () => {
  const parts = split(); parts[1] = { ...parts[1], sha256: 'b'.repeat(64) };
  assert.throws(() => reassembleCompanion(parts, identity), /Conflicting fragment metadata/);
});
