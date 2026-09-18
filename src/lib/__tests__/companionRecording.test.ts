import { describe, expect, it } from 'vitest';
import { parseCompanionRecording, matchCompanionRecording, companionObservationsAt } from '../insight/companionRecording';

const fixture = () => ({ schemaVersion: 1, recordingId: 'synthetic-test', account: 'Test.1234', gameBuild: 1,
  collectorVersion: 'prototype', encounter: { logSha256: 'a'.repeat(64), durationMs: 10000 },
  clock: { basis: 'encounter-relative', uncertaintyMs: 10 }, gaps: [],
  events: [{ sequence: 1, timeMs: 1000, source: 'model-estimated', kind: 'skill-state', skillId: 1, charges: 1, maxCharges: 2 }] });
const parse = (value: unknown) => parseCompanionRecording(JSON.stringify(value));

describe('companion recording boundary', () => {
  it('retains provenance and requires exact encounter binding', () => {
    const r = parse(fixture());
    const target = { ...r.encounter, gameBuild: 1, accounts: ['Test.1234'] };
    expect(matchCompanionRecording(r, target).matched).toBe(true);
    expect(matchCompanionRecording(r, { ...target, logSha256: 'b'.repeat(64) }).matched).toBe(false);
    expect(matchCompanionRecording(r, { ...target, accounts: [] }).matched).toBe(false);
    expect(matchCompanionRecording(r, { ...target, gameBuild: 2 }).matched).toBe(false);
    expect(companionObservationsAt(r, 1000)[0].event.source).toBe('model-estimated');
  });
  it('does not carry snapshots forward or fill gaps', () => {
    const r = parse(fixture());
    expect(companionObservationsAt(r, 1100)).toEqual([]);
    r.gaps.push({ startMs: 1005, endMs: 2000 });
    expect(companionObservationsAt(r, 1000)).toEqual([]);
  });
  it('rejects invalid charges, event ordering and unsupported versions', () => {
    const r = fixture();
    expect(() => parse({ ...r, schemaVersion: 2 })).toThrow();
    expect(() => parse({ ...r, events: [r.events[0], r.events[0]] })).toThrow();
    expect(() => parse({ ...r, events: [{ ...r.events[0], charges: 3 }] })).toThrow();
    expect(() => parse({ ...r, events: [{ ...r.events[0], timeMs: 11000 }] })).toThrow();
    expect(() => parse({ ...r, events: [{ ...r.events[0], source: 'verified' }] })).toThrow();
    expect(() => parseCompanionRecording('x'.repeat(5_000_001))).toThrow('5 MB');
  });
  it('accepts explicit loadout and endurance observations but rejects impossible values', () => {
    const r = fixture();
    const base = { sequence: 1, timeMs: 0, source: 'player-provided' };
    expect(parse({ ...r, events: [{ ...base, kind: 'loadout', skillIds: [1, 2] }] }).events).toHaveLength(1);
    expect(parse({ ...r, events: [{ ...base, kind: 'endurance', value: 50, capacity: 100 }] }).events).toHaveLength(1);
    expect(() => parse({ ...r, events: [{ ...base, kind: 'endurance', value: 101, capacity: 100 }] })).toThrow();
    expect(() => parse({ ...r, events: [{ ...base, kind: 'loadout', skillIds: [1, 1] }] })).toThrow();
  });
});
