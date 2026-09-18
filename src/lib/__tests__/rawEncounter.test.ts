import { describe, expect, it } from 'vitest';
import { parseRawCapture } from '../insight/rawCapture';
import { matchRawEncounter } from '../insight/rawEncounter';

function fixture() {
  const buffer = new ArrayBuffer(120 + 3 * 64), bytes = new Uint8Array(buffer), data = new DataView(buffer);
  bytes.set(new TextEncoder().encode('EVTC')); bytes[12] = 1; data.setUint32(16, 1, true);
  data.setBigUint64(20, 2000n, true); bytes.set(new TextEncoder().encode('Character\0:Example.1234\0'), 48);
  for (const [index, state] of [9, 10, 13].entries()) {
    const offset = 120 + index * 64; bytes[offset + 56] = state;
    data.setBigUint64(offset, BigInt(1000 + index * 100), true);
    data.setBigUint64(offset + 8, state === 13 ? 2000n : 0x637261n, true);
  }
  const capture = parseRawCapture(JSON.stringify({ type: 'header', format: 'entropy-arc-callbacks', version: 1 }), 'test');
  capture.accounts = ['Example.1234'];
  const boundary = bytes.slice(120, 184); new DataView(boundary.buffer).setBigUint64(8, 1n, true);
  capture.boundaries = [{ stream: 'area', rawHex: [...boundary].map(v => v.toString(16).padStart(2, '0')).join('') }];
  return { buffer, capture };
}
describe('raw encounter boundary matching', () => {
  it('matches only the documented marker substitution and retains unresolved ends', () => {
    const { buffer, capture } = fixture();
    expect(matchRawEncounter(capture, buffer, 'fight.evtc')).toMatchObject({ status: 'start-matched', recorder: 'Example.1234', startTick: 1000, endTick: 1100, exactEnd: false });
  });
  it('rejects mismatching bytes, duplicate observations and unrelated recorders', () => {
    const { buffer, capture } = fixture();
    new Uint8Array(buffer)[120 + 24] = 1;
    expect(matchRawEncounter(capture, buffer, 'fight').status).toBe('unmatched');
    const other = fixture(); other.capture.boundaries.push(other.capture.boundaries[0]);
    expect(matchRawEncounter(other.capture, other.buffer, 'fight').status).toBe('unmatched');
    const wrong = fixture(); wrong.capture.accounts = ['Other.1234'];
    expect(matchRawEncounter(wrong.capture, wrong.buffer, 'fight').status).toBe('unmatched');
  });
  it('rejects malformed tables and unsupported layouts', () => {
    const { buffer, capture } = fixture();
    expect(() => matchRawEncounter(capture, buffer.slice(0, -1), 'bad')).toThrow();
    new Uint8Array(buffer)[12] = 2;
    expect(() => matchRawEncounter(capture, buffer, 'bad')).toThrow();
  });
});
