import { describe, expect, it } from 'vitest';
import { captureSignals, parseRawCapture, rawCaptureEvidence } from '../insight/rawCapture';

const header = { type: 'header', format: 'entropy-arc-callbacks', version: 1, collectorVersion: '0.1.1' };
function callback(sequence = '1', state = 67) {
  const bytes = new Uint8Array(64); const view = new DataView(bytes.buffer);
  view.setBigUint64(0, 12345n, true); view.setBigUint64(8, 2000n, true); view.setUint32(36, 5516, true); bytes[56] = state;
  return { type: 'callback', sequence, stream: 'area', revision: 1, rawHex: [...bytes].map(v => v.toString(16).padStart(2, '0')).join('') };
}
const footer = { type: 'end', attempted: 1, written: 1, queueDropped: 0, writerDiscarded: 0, sizeLimited: false, writeFailed: false };
const parse = (...rows: unknown[]) => parseRawCapture([header, ...rows].map(r => JSON.stringify(r)).join('\n'), 'test.jsonl');
describe('raw capture evidence', () => {
  it('does not require in-flight segment counters to balance at rotation', () => {
    const h = { ...header, segment: 1, sessionId: 'entropy-test-rotation' };
    const end = { ...footer, scope: 'segment', continued: true, sessionAttempted: 100, sessionWritten: 1, unsupportedRevision: 0 };
    const c = parseRawCapture([h, callback(), end].map(row => JSON.stringify(row)).join('\n'), 'part1');
    expect(c.segment?.continued).toBe(true);
    expect(c.retention).toBeNull();
  });
  it('rejects segment/header scope mismatch and invalid identity', () => {
    const h = { ...header, segment: 1, sessionId: 'entropy-test' };
    expect(() => parseRawCapture([h, callback(), footer].map(row => JSON.stringify(row)).join('\n'), 'part')).toThrow(/scope/);
    expect(() => parseRawCapture(JSON.stringify({ ...h, segment: -1 }), 'part')).toThrow(/identity/);
  });
  it('accepts rotated segments without presenting global counters as local coverage', () => {
    const header = { type: 'header', format: 'entropy-arc-callbacks', version: 1, segment: 2, sessionId: 'entropy-test-123' };
    const end = { ...footer, scope: 'segment', continued: false, sessionAttempted: 10, sessionWritten: 8, writerDiscarded: 2, unsupportedRevision: 0 };
    const c = parseRawCapture([header, callback(), end].map(row => JSON.stringify(row)).join('\n'), 'part');
    expect(c.retention).toBeNull(); expect(c.dropped).toBeNull();
    expect(c.segment?.index).toBe(2);
    expect(c.warnings.join(' ')).toContain('continuity');
    expect(() => parseRawCapture([header, callback(), { ...end, sessionWritten: 9 }].map(row => JSON.stringify(row)).join('\n'), 'bad')).toThrow(/accounting/);
  });
  it('preserves large destination IDs, signed duration values and raw removal reasons', () => {
    const event = callback('1', 71);
    const bytes = Uint8Array.from(event.rawHex.match(/../g)!, v => parseInt(v, 16));
    const view = new DataView(bytes.buffer);
    view.setBigUint64(16, 9007199254740993n, true);
    view.setInt32(24, -1250, true); bytes[52] = 3;
    event.rawHex = [...bytes].map(v => v.toString(16).padStart(2, '0')).join('');
    const capture = parse(event, footer);
    expect(capture.events[0].details).toEqual({
      'Destination field': '9007199254740993',
      'Duration value (ms)': -1250,
      'Raw removal code': 3,
      Meaning: 'Buff removed from source; destination is the removing agent field',
      'Removal origin': 'ArcDPS-derived single removal from all-stack removal',
    });
    capture.accounts = ['Example.1234'];
    const evidence = rawCaptureEvidence(capture, 'Example.1234');
    expect(evidence?.data.areaDetailAvailability['Raw removal code']).toBe(1);
    expect(evidence?.data.detailMeaning).toContain('do not infer cleanses or interrupts');
  });
  it('exposes animation timings without decoding unknown event layouts', () => {
    expect(parse(callback()).events[0].details).toHaveProperty('Significant duration (ms)', 0);
    expect(parse(callback('1', 68)).events[0].details).toHaveProperty('Raw progress code', 0);
    expect(parse(callback('1', 49)).events[0].details).toEqual({});
    expect(parse({ ...callback(), revision: 2 }).events[0].details).toEqual({});
  });
  it('quantifies writer losses separately from queue drops', () => {
    const capture = parse(callback(), { ...footer, attempted: 10, writerDiscarded: 9, sizeLimited: true });
    expect(capture.dropped).toBe(0);
    expect(capture.retention).toEqual({ attempted: 10, writerDiscarded: 9, savedPercent: 10, sizeLimited: true });
    capture.accounts = ['Example.1234'];
    expect(rawCaptureEvidence(capture, 'Example.1234')?.data.retention?.savedPercent).toBe(10);
    expect(captureSignals(capture).find(s => s.label === 'Animation starts')?.count).toBe(1);
  });
  it('does not sum local and area signals or treat empty captures as full coverage', () => {
    const capture = parse(callback(), { ...callback('2'), stream: 'local' });
    expect(captureSignals(capture).find(s => s.label === 'Animation starts')?.count).toBe(1);
    expect(capture.retention).toBeNull();
    expect(parse({ ...footer, attempted: 0, written: 0 }).retention?.savedPercent).toBeNull();
  });
  it('decodes supported revision one events and verifies shutdown', () => {
    const capture = parse(callback(), footer);
    expect(capture.events[0]).toMatchObject({ tick: 12345, skillId: 5516, sourceId: '2000', kind: 'Animation start' });
    expect(capture.warnings).toEqual([]);
    expect(capture.finalized).toBe(true);
  });
  it('does not decode overloaded fields in unknown events', () => {
    expect(parse(callback('1', 49)).events[0]).toMatchObject({ kind: 'Uninterpreted 49', tick: null, skillId: null });
  });
  it('rejects duplicate callbacks, invalid records and mismatching accounting', () => {
    expect(() => parse(callback(), callback())).toThrow(/duplicate/);
    expect(() => parse(null)).toThrow(/Invalid/);
    expect(() => parse(callback(), { ...footer, attempted: 2 })).toThrow(/totals/);
    expect(() => parse(callback(), footer, callback('2'))).toThrow(/shutdown/);
  });
  it('reports partial capture and writer loss instead of clean coverage', () => {
    expect(parse(callback()).warnings.length).toBeGreaterThan(0);
    const capture = parse(callback(), { ...footer, attempted: 3, writerDiscarded: 2, writeFailed: true });
    expect(capture.warnings).toContain('2 callbacks discarded by writer.');
  });
  it('only supplies session-scoped evidence for the identified recorder', () => {
    const nameUtf8Hex = [...new TextEncoder().encode(':Example.1234')].map(v => v.toString(16).padStart(2, '0')).join('');
    const capture = parse({ ...callback(), rawHex: null, src: { profession: 1, elite: 0 }, dst: { self: 1, nameUtf8Hex } }, footer);
    expect(capture.accounts).toEqual(['Example.1234']);
    expect(rawCaptureEvidence(capture, 'Other.1234')).toBeNull();
    expect(rawCaptureEvidence(capture, 'Example.1234')?.data.scope).toContain('Whole companion session');
  });
});
