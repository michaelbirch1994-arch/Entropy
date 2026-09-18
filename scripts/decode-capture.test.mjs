import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeCallback } from './decode-capture.mjs';
function row(state) {
  const b = Buffer.alloc(64); b[56] = state; b.writeBigUInt64LE(123456n); b.writeBigUInt64LE(9007199254740993n, 8);
  b.writeUInt32LE(123, 36); b.writeInt32LE(500, 24); b.writeInt32LE(600, 28);
  return { type: 'callback', sequence: '1', arcId: '2', stream: 'local', revision: 1, rawHex: b.toString('hex') };
}
test('decodes animation fields without losing large IDs', () => {
  assert.deepEqual(decodeCallback(row(67)), { sequence: '1', stream: 'local', arcId: '2', kind: 'animation-start',
    state: 67, eventTickMs: '123456', sourceField: '9007199254740993', destinationField: '0', skillId: 123,
    significantDurationMs: 500, controlReturnDurationMs: 600 });
  assert.equal(decodeCallback(row(68)).elapsedDurationMs, 600);
});
test('unknown types and revisions never produce timestamps', () => {
  assert.equal(decodeCallback(row(31)).eventTickMs, null);
  assert.equal(decodeCallback({ ...row(67), revision: 2 }).kind, 'unsupported-revision');
  assert.equal(decodeCallback({ ...row(0), rawHex: null }).kind, 'agent-metadata');
  assert.throws(() => decodeCallback({ ...row(0), rawHex: 'bad' }));
});
test('separates boundaries, survival and buff removal observations', () => {
  assert.equal(decodeCallback(row(9)).serverUnixSeconds, 500);
  assert.equal(decodeCallback(row(10)).kind, 'squad-end');
  assert.equal(decodeCallback(row(5)).kind, 'down');
  assert.equal(decodeCallback(row(71)).kind, 'buff-remove-single');
  assert.equal(decodeCallback(row(71)).removalCode, 0);
});
