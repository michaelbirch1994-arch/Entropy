import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Explicit subset reviewed against ArcDPS EVTC documentation on 2026-09-10.
const kinds = new Map([[0, 'combat'], [1, 'enter-combat'], [2, 'exit-combat'],
  [3, 'alive'], [4, 'dead'], [5, 'down'], [9, 'squad-start'], [10, 'squad-end'],
  [11, 'weapon-swap'], [56, 'stunbreak'], [67, 'animation-start'], [68, 'animation-stop'],
  [69, 'buff-apply'], [70, 'buff-duration-change'], [71, 'buff-remove-single'], [72, 'buff-remove-all']]);

export function decodeCallback(row) {
  if (row.type !== 'callback') throw new Error('Expected callback');
  if (!['local', 'area'].includes(row.stream) || !/^\d+$/.test(row.sequence)) throw new Error('Invalid callback identity');
  const base = { sequence: row.sequence, stream: row.stream, arcId: row.arcId };
  if (row.rawHex === null) return { ...base, kind: 'agent-metadata', eventTickMs: null };
  if (row.revision !== 1) return { ...base, kind: 'unsupported-revision', eventTickMs: null };
  if (typeof row.rawHex !== 'string' || !/^[a-f0-9]{128}$/i.test(row.rawHex)) throw new Error('Invalid raw event bytes');
  const b = Buffer.from(row.rawHex, 'hex');
  const state = b[56];
  const kind = kinds.get(state);
  // Unknown types can overload time with non-time data; do not interpret them.
  if (!kind) return { ...base, kind: 'uninterpreted', state, eventTickMs: null };
  const event = { ...base, kind, state, eventTickMs: b.readBigUInt64LE(0).toString(),
    sourceField: b.readBigUInt64LE(8).toString(), destinationField: b.readBigUInt64LE(16).toString(),
    skillId: b.readUInt32LE(36) };
  if (state === 9 || state === 10) return { ...event, serverUnixSeconds: b.readUInt32LE(24), localUnixSeconds: b.readUInt32LE(28) };
  if (state === 67) return { ...event, significantDurationMs: b.readInt32LE(24), controlReturnDurationMs: b.readInt32LE(28) };
  if (state === 68) return { ...event, scaledDurationMs: b.readInt32LE(24), elapsedDurationMs: b.readInt32LE(28), progressCode: b[51] };
  if ([69, 70, 71, 72].includes(state)) return { ...event, durationValueMs: b.readInt32LE(24), removalCode: [71, 72].includes(state) ? b[52] : null };
  return event;
}

export async function summarizeCapture(path) {
  const counts = { local: {}, area: {} }; const boundaries = []; const skills = new Map();
  let header = null, footer = null, callbacks = 0, lineNumber = 0;
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (line.length > 100_000) throw new Error('Capture line exceeds limit');
      ++lineNumber;
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      if (!header) {
        if (row.type !== 'header' || row.format !== 'entropy-arc-callbacks' || row.version !== 1) throw new Error('Unsupported capture header');
        header = row; continue;
      }
      if (footer) throw new Error('Records follow shutdown footer');
      if (row.type === 'end') { footer = row; continue; }
      const e = decodeCallback(row); ++callbacks;
      const key = e.kind === 'uninterpreted' ? `uninterpreted-${e.state}` : e.kind;
      counts[e.stream][key] = (counts[e.stream][key] ?? 0) + 1;
      if (e.kind === 'squad-start' || e.kind === 'squad-end') {
        if (boundaries.length >= 10000) throw new Error('Too many combat boundaries');
        boundaries.push(e);
      }
      if (e.kind === 'animation-start') {
        const key = `${e.stream}:${e.skillId}`;
        if (skills.size >= 100000 && !skills.has(key)) throw new Error('Too many distinct skills');
        skills.set(key, (skills.get(key) ?? 0) + 1);
      }
    }
  } catch (error) { throw new Error(`Capture line ${lineNumber}: ${error.message}`); }
  if (!header) throw new Error('Empty capture');
  return { collectorVersion: header.collectorVersion, callbacks, footer,
    footerCountMatches: footer ? footer.written === callbacks : null, counts, boundaries,
    animationStartsByStreamAndSkill: Object.fromEntries(skills),
    limitations: ['Animation start is not successful completion or readiness.',
      'Raw clock ticks are not fight-relative times. Boundaries are unpaired observations.',
      'Streams may overlap. Buff removal does not establish a cleanse without decoding its removal reason.',
      'Unsupported records are not interpreted; IDs are not resolved to player accounts.'] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/decode-capture.mjs <capture.jsonl>');
    console.log(JSON.stringify(await summarizeCapture(process.argv[2]), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
