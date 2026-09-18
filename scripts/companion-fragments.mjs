import { createHash } from 'node:crypto';
import { parseCompanionRecording } from '../src/lib/insight/companionRecording.ts';
import { parseLoadoutSnapshot } from '../src/lib/insight/loadoutSnapshot.ts';

// Offline envelope only: these are not allocated ArcDPS extension records.
const MAX_BYTES = 262144;
const CHUNK_BYTES = 1024;
const MAX_PARTS = MAX_BYTES / CHUNK_BYTES;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const label = value => typeof value === 'string' && value.length > 0 && value.length <= 200;

export function fragmentCompanion(text, sessionId, snapshotId) {
  return fragment(text, sessionId, snapshotId, 'entropy-companion-fragments', parseCompanionRecording);
}

export function fragmentLoadout(text) {
  const snapshot = parseLoadoutSnapshot(text);
  return fragment(text, snapshot.sessionId, snapshot.snapshotId, 'entropy-loadout-fragments', parseLoadoutSnapshot);
}

function fragment(text, sessionId, snapshotId, format, validate) {
  if (!label(sessionId) || !label(snapshotId)) throw Error('Invalid envelope identity');
  if (typeof text !== 'string' || text.length > MAX_BYTES) throw Error('Envelope size limit');
  const bytes = Buffer.from(text, 'utf8');
  if (!bytes.length || bytes.length > MAX_BYTES) throw Error('Envelope size limit');
  validate(text);
  const count = Math.ceil(bytes.length / CHUNK_BYTES);
  const sha256 = digest(bytes);
  return Array.from({ length: count }, (_, index) => ({
    format, version: 1, sessionId, snapshotId,
    index, count, byteLength: bytes.length, sha256,
    payload: bytes.subarray(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES).toString('base64'),
  }));
}

export function reassembleCompanion(parts, expected) {
  const result = reassemble(parts, expected, 'entropy-companion-fragments');
  return { recording: parseCompanionRecording(result.text), sha256: result.sha256,
    provenance: 'Imported claim; checksum verifies integrity, not sender authenticity or active loadout' };
}

export function reassembleLoadout(parts, expected) {
  if (!label(expected?.account)) throw Error('Expected account required');
  const result = reassemble(parts, expected, 'entropy-loadout-fragments');
  const snapshot = parseLoadoutSnapshot(result.text);
  if (snapshot.sessionId !== expected.sessionId || snapshot.snapshotId !== expected.snapshotId || snapshot.account !== expected.account) throw Error('Payload identity mismatch');
  return { snapshot, sha256: result.sha256,
    provenance: 'Imported loadout claim; no authentication, encounter binding or continuity established' };
}

function reassemble(parts, expected, format) {
  if (!label(expected?.sessionId) || !label(expected?.snapshotId)) throw Error('Expected identity required');
  if (!Array.isArray(parts) || !parts.length || parts.length > MAX_PARTS * 2) throw Error('Invalid fragment count');
  let header;
  const chunks = new Map();
  for (const part of parts) {
    if (!part || part.format !== format || part.version !== 1) throw Error('Unsupported envelope');
    if (part.sessionId !== expected.sessionId || part.snapshotId !== expected.snapshotId) throw Error('Envelope identity mismatch');
    if (!Number.isSafeInteger(part.byteLength) || part.byteLength < 1 || part.byteLength > MAX_BYTES
      || !Number.isSafeInteger(part.count) || part.count !== Math.ceil(part.byteLength / CHUNK_BYTES)
      || !Number.isSafeInteger(part.index) || part.index < 0 || part.index >= part.count
      || typeof part.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(part.sha256)) throw Error('Invalid fragment metadata');
    if (header && (header.count !== part.count || header.byteLength !== part.byteLength || header.sha256 !== part.sha256)) throw Error('Conflicting fragment metadata');
    header = part;
    if (typeof part.payload !== 'string' || part.payload.length > 1368) throw Error('Invalid fragment payload');
    const bytes = Buffer.from(part.payload, 'base64');
    const expectedLength = part.index === part.count - 1 ? part.byteLength - part.index * CHUNK_BYTES : CHUNK_BYTES;
    if (bytes.length !== expectedLength || bytes.toString('base64') !== part.payload) throw Error('Invalid fragment encoding or length');
    const previous = chunks.get(part.index);
    if (previous && !previous.equals(bytes)) throw Error('Conflicting duplicate fragment');
    chunks.set(part.index, bytes);
  }
  if (chunks.size !== header.count) throw Error('Incomplete snapshot');
  const bytes = Buffer.concat(Array.from({ length: header.count }, (_, i) => chunks.get(i)));
  if (digest(bytes) !== header.sha256) throw Error('Snapshot checksum mismatch');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return { text, sha256: header.sha256 };
}
