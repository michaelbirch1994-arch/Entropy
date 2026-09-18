import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodeCallback } from './decode-capture.mjs';

export function readEncounter(buffer) {
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'EVTC' || buffer[12] !== 1) throw new Error('Unsupported EVTC');
  const agents = buffer.readUInt32LE(16);
  const skillsOffset = 20 + agents * 96;
  if (skillsOffset + 4 > buffer.length) throw new Error('Truncated agents');
  const start = skillsOffset + 4 + buffer.readUInt32LE(skillsOffset) * 68;
  if (start > buffer.length || (buffer.length - start) % 64) throw new Error('Invalid event table');
  const boundaries = []; let pov = null;
  for (let offset = start; offset < buffer.length; offset += 64) {
    const event = buffer.subarray(offset, offset + 64);
    if (event[56] === 13) pov = event.readBigUInt64LE(8).toString();
    if (event[56] === 9 || event[56] === 10) boundaries.push({ rawHex: event.toString('hex'), kind: event[56] === 9 ? 'squad-start' : 'squad-end', tick: event.readBigUInt64LE().toString() });
  }
  const players = [];
  for (let i = 0; i < agents; i++) {
    const offset = 20 + i * 96;
    const id = buffer.readBigUInt64LE(offset).toString();
    const [character, account] = buffer.toString('utf8', offset + 28, offset + 92).split('\0');
    if (account) players.push({ id, character, account: account.replace(/^:/, ''), recordingPlayer: id === pov });
  }
  return { boundaries, recordingPlayer: players.find(p => p.recordingPlayer) ?? null };
}

export function matchEncounter(rows, encounter) {
  const matches = encounter.boundaries.map(boundary => {
    const observations = rows.filter(r => r.type === 'callback' && r.rawHex === boundary.rawHex && r.revision === 1)
      .map(r => ({ sequence: r.sequence, stream: r.stream }));
    return { kind: boundary.kind, tick: boundary.tick, observations };
  });
  const starts = matches.filter(m => m.kind === 'squad-start');
  const ends = matches.filter(m => m.kind === 'squad-end');
  const distinctPerStream = m => ['local', 'area'].every(s => m.observations.filter(o => o.stream === s).length <= 1);
  const paired = starts.length === 1 && ends.length === 1 && starts[0].observations.length > 0 && ends[0].observations.length > 0
    && matches.every(distinctPerStream) && BigInt(ends[0].tick) >= BigInt(starts[0].tick);
  const anchor = findStartAnchor(rows, encounter);
  return { status: paired ? 'Exact boundary pair' : anchor ? 'Start anchored; end remains distinct' : 'Unresolved boundaries', recordingPlayer: encounter.recordingPlayer,
    startAnchor: anchor,
    boundaryDurationMs: paired ? (BigInt(ends[0].tick) - BigInt(starts[0].tick)).toString() : null, matches };
}

/** Narrow observed transformation: EVTC source marker 'arc' replaces callback 1.
 * Every other byte must match. This is not a general fuzzy boundary matcher. */
export function findStartAnchor(rows, encounter) {
  const starts = encounter.boundaries.filter(b => b.kind === 'squad-start');
  if (starts.length !== 1) return null;
  const start = starts[0];
  const fileBytes = Buffer.from(start.rawHex, 'hex');
  const eligible = rows.filter(r => {
    if (r.type !== 'callback' || r.revision !== 1 || !['local', 'area'].includes(r.stream) || !/^[a-f0-9]{128}$/i.test(r.rawHex ?? '')) return false;
    const bytes = Buffer.from(r.rawHex, 'hex');
    if (bytes.equals(fileBytes)) return true;
    if (fileBytes.readBigUInt64LE(8) !== 0x637261n || bytes.readBigUInt64LE(8) !== 1n) return false;
    return bytes.subarray(0, 8).equals(fileBytes.subarray(0, 8)) && bytes.subarray(16).equals(fileBytes.subarray(16));
  });
  if (!eligible.length || ['local', 'area'].some(s => eligible.filter(r => r.stream === s).length > 1)) return null;
  const ends = encounter.boundaries.filter(b => b.kind === 'squad-end');
  const end = ends.length === 1 ? ends[0] : null;
  const nearEnds = end ? rows.filter(r => r.type === 'callback' && r.revision === 1 && /^[a-f0-9]{128}$/i.test(r.rawHex ?? ''))
    .flatMap(r => {
      const b = Buffer.from(r.rawHex, 'hex');
      if (b[56] !== 10) return [];
      const difference = BigInt(end.tick) - b.readBigUInt64LE(0);
      if (difference < -1000n || difference > 1000n) return [];
      return [{ stream: r.stream, sequence: r.sequence, tick: b.readBigUInt64LE(0).toString(), fileMinusCallbackMs: difference.toString() }];
    }) : [];
  return { tick: start.tick, method: 'Exact start bytes with only the observed arc/1 source-marker substitution allowed',
    observations: eligible.map(r => ({ sequence: r.sequence, stream: r.stream })),
    fileEndTick: end?.tick ?? null, nearbyEndObservations: nearEnds,
    endInterpretation: 'Nearby ends are diagnostic candidates, not an applied clock correction.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [capture, ...logs] = process.argv.slice(2);
    if (!capture || !logs.length) throw new Error('Usage: node scripts/match-capture-encounters.mjs <capture.jsonl> <uncompressed.evtc> ...');
    const rows = readFileSync(capture, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    const identities = rows.filter(r => r.type === 'callback' && r.rawHex === null && r.dst?.self === 1 && r.src?.profession > 0 && r.src?.elite !== 1)
      .map(r => ({ sequence: r.sequence, stream: r.stream, character: Buffer.from(r.src.nameUtf8Hex, 'hex').toString('utf8'),
        account: Buffer.from(r.dst.nameUtf8Hex, 'hex').toString('utf8').replace(/^:/, ''), instanceId: r.dst.id }));
    const decodedBoundaryCount = rows.filter(r => r.type === 'callback').map(decodeCallback).filter(e => ['squad-start', 'squad-end'].includes(e.kind)).length;
    console.log(JSON.stringify({ identities, decodedBoundaryCount,
      logs: logs.map(path => ({ file: basename(path), ...matchEncounter(rows, readEncounter(readFileSync(path))) })),
      limitation: 'Exact boundary identity is not full event coverage. Character metadata is not a global actor-ID mapping; no clock-wrap correction or EI phase alignment is assumed.' }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
