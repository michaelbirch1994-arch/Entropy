import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readEncounter, matchEncounter, findStartAnchor } from './match-capture-encounters.mjs';
function fixture() {
  const b = Buffer.alloc(20 + 96 + 4 + 192); b.write('EVTC20260910'); b[12] = 1; b.writeUInt32LE(1, 16);
  b.writeBigUInt64LE(123n, 20); b.write(['Example', ':Example.1234', '1', ''].join('\0'), 48);
  const start = 120; b[start + 56] = 13; b.writeBigUInt64LE(123n, start + 8);
  b[start + 64 + 56] = 9; b.writeBigUInt64LE(1000n, start + 64);
  b[start + 128 + 56] = 10; b.writeBigUInt64LE(2000n, start + 128);
  return b;
}
test('extracts recording player and exact paired boundaries', () => {
  const e = readEncounter(fixture());
  assert.equal(e.recordingPlayer.account, 'Example.1234');
  const rows = e.boundaries.map((b, i) => ({ type: 'callback', revision: 1, stream: 'area', sequence: String(i + 1), rawHex: b.rawHex }));
  assert.equal(matchEncounter(rows, e).status, 'Exact boundary pair');
  assert.equal(matchEncounter(rows, e).boundaryDurationMs, '1000');
  assert.equal(matchEncounter(rows.slice(1), e).status, 'Unresolved boundaries');
  assert.equal(matchEncounter([...rows, rows[0]], e).status, 'Unresolved boundaries');
});
test('permits only the observed source-marker substitution and preserves end differences', () => {
  const e = readEncounter(fixture());
  const fileStart = Buffer.from(e.boundaries[0].rawHex, 'hex'); fileStart.writeBigUInt64LE(0x637261n, 8);
  e.boundaries[0].rawHex = fileStart.toString('hex');
  const callback = Buffer.from(fileStart); callback.writeBigUInt64LE(1n, 8);
  const end = Buffer.from(e.boundaries[1].rawHex, 'hex'); end.writeBigUInt64LE(1750n);
  const row = raw => ({ type: 'callback', revision: 1, stream: 'area', sequence: '1', rawHex: raw.toString('hex') });
  const rows = [row(callback), row(end)];
  assert.equal(findStartAnchor(rows, e).tick, '1000');
  assert.equal(findStartAnchor(rows, e).nearbyEndObservations[0].fileMinusCallbackMs, '250');
  assert.equal(matchEncounter(rows, e).status, 'Start anchored; end remains distinct');
  assert.equal(findStartAnchor([...rows, rows[0]], e), null);
  callback.writeUInt32LE(999, 24);
  assert.equal(findStartAnchor([row(callback)], e), null);
  callback.writeUInt32LE(0, 24); callback.writeBigUInt64LE(2n, 8);
  assert.equal(findStartAnchor([row(callback)], e), null);
});
test('rejects malformed event boundaries', () => {
  assert.throws(() => readEncounter(Buffer.alloc(10)));
  assert.throws(() => readEncounter(fixture().subarray(0, -1)));
});
