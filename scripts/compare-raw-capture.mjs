import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

// Diagnostic exact-byte matching only, not a replacement EVTC parser.
const [capturePath, ...logs] = process.argv.slice(2);
if (!capturePath || !logs.length) throw new Error('Usage: node scripts/compare-raw-capture.mjs <capture.jsonl> <uncompressed.evtc> ...');
const rows = readFileSync(capturePath, 'utf8').trim().split('\n').map(line => JSON.parse(line));
const streams = { local: new Map(), area: new Map() };
for (const r of rows) {
  if (r.type !== 'callback' || r.rawHex === null) continue;
  if (!streams[r.stream] || !/^[a-f0-9]{128}$/.test(r.rawHex)) throw new Error('Invalid capture record');
  streams[r.stream].set(r.rawHex, (streams[r.stream].get(r.rawHex) ?? 0) + 1);
}
const results = logs.map(path => {
  const b = readFileSync(path);
  if (b.length < 20 || b.toString('ascii', 0, 4) !== 'EVTC' || b[12] !== 1) throw new Error('Unsupported EVTC header');
  const agents = b.readUInt32LE(16);
  const skillOffset = 20 + agents * 96;
  if (skillOffset + 4 > b.length) throw new Error('Truncated agents');
  const skills = b.readUInt32LE(skillOffset);
  const start = skillOffset + 4 + skills * 68;
  if (start > b.length || (b.length - start) % 64) throw new Error('Invalid event boundary');
  const available = { local: new Map(streams.local), area: new Map(streams.area) };
  const matches = { local: 0, area: 0 };
  const states = {};
  let ordinary = 0, ordinaryMatched = 0;
  for (let offset = start; offset < b.length; offset += 64) {
    const event = b.subarray(offset, offset + 64);
    const hex = event.toString('hex');
    const state = event[56];
    states[state] = (states[state] ?? 0) + 1;
    let matched = false;
    for (const stream of ['local', 'area']) {
      const count = available[stream].get(hex) ?? 0;
      if (count) { matches[stream]++; available[stream].set(hex, count - 1); matched = true; }
    }
    if (state === 0) { ordinary++; if (matched) ordinaryMatched++; }
  }
  return { file: basename(path), agents, skills, events: (b.length - start) / 64, exactMatches: matches,
    ordinaryCombatRecords: ordinary, ordinaryExactMatchesEitherStream: ordinaryMatched,
    ordinaryExactMatchPercent: ordinary ? +(ordinaryMatched / ordinary * 100).toFixed(2) : null, stateCounts: states };
});
console.log(JSON.stringify({ footer: rows.findLast(r => r.type === 'end') ?? null, logs: results,
  interpretation: 'Exact byte agreement only. Unmatched records may be file-only events, transformed fields, capture loss or outside capture scope. Stream matches can overlap.' }, null, 2));
