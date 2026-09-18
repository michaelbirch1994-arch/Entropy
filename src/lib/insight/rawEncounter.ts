import type { RawCapture, RawEncounterMatch } from './rawCapture';

const hex = (bytes: Uint8Array) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');

/** Match file identity using boundary bytes, never filenames or approximate time. */
export function matchRawEncounter(capture: RawCapture, buffer: ArrayBuffer, name: string): RawEncounterMatch {
  if (buffer.byteLength < 20 || buffer.byteLength > 150000000) throw new Error('Unsupported EVTC size.');
  const bytes = new Uint8Array(buffer), data = new DataView(buffer);
  if (new TextDecoder().decode(bytes.subarray(0, 4)) !== 'EVTC' || bytes[12] !== 1) throw new Error('Select an uncompressed revision-one .evtc file.');
  const agentCount = data.getUint32(16, true), skillOffset = 20 + agentCount * 96;
  if (skillOffset + 4 > bytes.length) throw new Error('Truncated agent table.');
  const eventOffset = skillOffset + 4 + data.getUint32(skillOffset, true) * 68;
  if (eventOffset > bytes.length || (bytes.length - eventOffset) % 64) throw new Error('Invalid event table.');
  const starts: number[] = [], ends: number[] = [], povs = new Set<string>();
  for (let offset = eventOffset; offset < bytes.length; offset += 64) {
    const state = bytes[offset + 56];
    if (state === 9) starts.push(offset);
    if (state === 10) ends.push(offset);
    if (state === 13) povs.add(data.getBigUint64(offset + 8, true).toString());
  }
  const accounts = new Set<string>();
  if (povs.size === 1) for (let index = 0; index < agentCount; index++) {
    const offset = 20 + index * 96;
    if (!povs.has(data.getBigUint64(offset, true).toString())) continue;
    const account = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(offset + 28, offset + 92)).split('\0')[1]?.replace(/^:/, '');
    if (account) accounts.add(account);
  }
  const recorder = accounts.size === 1 ? [...accounts][0] : null;
  const unknown: RawEncounterMatch = { name, recorder, status: 'unmatched', startTick: null, endTick: null, exactEnd: false };
  if (starts.length !== 1 || !recorder || !capture.accounts.includes(recorder)) return unknown;
  const startOffset = starts[0], startHex = hex(bytes.subarray(startOffset, startOffset + 64));
  // The only accepted transformation is the observed EVTC 'arc' marker to
  // callback 1; all other 56 bytes must remain identical.
  const callbackHex = data.getBigUint64(startOffset + 8, true) === 0x637261n
    ? startHex.slice(0, 16) + '0100000000000000' + startHex.slice(32) : startHex;
  const matches = capture.boundaries.filter(b => b.rawHex === startHex || b.rawHex === callbackHex);
  if (!matches.length || ['local', 'area'].some(s => matches.filter(m => m.stream === s).length > 1)) return unknown;
  const tick = (offset: number) => { const value = data.getBigUint64(offset, true); return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null; };
  const startTick = tick(startOffset), endTick = ends.length === 1 ? tick(ends[0]) : null;
  if (startTick === null || (endTick !== null && endTick < startTick)) return unknown;
  const endHex = ends.length === 1 ? hex(bytes.subarray(ends[0], ends[0] + 64)) : null;
  const endMatches = capture.boundaries.filter(b => b.rawHex === endHex);
  const skillNames: Record<string, string> = {};
  const ambiguous = new Set<string>();
  for (let offset = skillOffset + 4; offset < eventOffset; offset += 68) {
    const id = String(data.getUint32(offset, true));
    const label = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 68)).split('\0')[0].trim();
    if (!label || ambiguous.has(id)) continue;
    if (skillNames[id] && skillNames[id] !== label) { delete skillNames[id]; ambiguous.add(id); }
    else skillNames[id] = label;
  }
  return { name, recorder, status: 'start-matched', startTick, endTick, skillNames,
    exactEnd: endMatches.length > 0 && ['local', 'area'].every(s => endMatches.filter(m => m.stream === s).length <= 1) };
}
