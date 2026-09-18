import { describe, expect, it } from 'vitest';
import type { ReplayPlayerTrack } from '../parseReplayData';
import { measureReadiness, measureReadinessBoundary, measureReadinessWindow } from '../insight/readiness';
const player = (states?: [number, number][], inSquad = true): ReplayPlayerTrack => ({
  account: 'Test.1234', name: 'Test', profession: 'Guardian', inSquad, isCommander: false,
  points: [], facings: [], casts: [], downIntervals: [], deadIntervals: [],
  effects: states ? [{ id: 1, name: 'Stability', classification: 'Boon', states }] : [],
});

describe('readiness continuity', () => {
  it('keeps a gain at the selected moment out of the before interval', () => {
    const r = measureReadinessWindow([player([[0, 0], [3000, 1]])], 'Stability', 3000, 3000, 10000);
    expect(r.before).toMatchObject({ presentMs: 0, absentMs: 3000, observedCoverage: 0 });
    expect(r.after).toMatchObject({ presentMs: 3000, absentMs: 0, observedCoverage: 1 });
  });
  it('integrates exact durations including unknown initial player-time', () => {
    const r = measureReadinessWindow([player([[2000, 1], [3500, 0]]), player()], 'Stability', 3000, 3000, 6000);
    expect(r.before).toMatchObject({ presentMs: 1000, absentMs: 0, unknownMs: 5000, totalMs: 6000, bounds: [1 / 6, 1] });
    expect(r.after).toMatchObject({ presentMs: 500, absentMs: 2500, unknownMs: 3000, observedCoverage: 1 / 6, bounds: [1 / 12, 7 / 12] });
  });
  it('clips at boundaries and represents no pre-fight interval without a zero score', () => {
    const r = measureReadinessWindow([player([[0, 1]])], 'Stability', 0, 3000, 1000);
    expect(r.before).toMatchObject({ totalMs: 0, observedCoverage: null, bounds: null });
    expect(r.after).toMatchObject({ endMs: 1000, presentMs: 1000 });
  });
  it('preserves conflicting transitions as unknown until a later valid transition', () => {
    const r = measureReadinessWindow([player([[0, 1], [1000, 1], [1000, 0], [2000, 1]])], 'Stability', 1500, 1500, 3000);
    expect(r.before.unknownMs + r.after.unknownMs).toBe(1000);
    expect(r.before.presentMs + r.after.presentMs).toBe(2000);
  });
  it('does not duplicate coverage when multiple matching effect tracks exist', () => {
    const p = player([[0, 1]]); p.effects.push({ ...p.effects[0] });
    const r = measureReadinessWindow([p], 'Stability', 1000, 1000, 3000);
    expect(r.before.unknownMs).toBe(1000);
    expect(r.after.unknownMs).toBe(1000);
  });
  it('conserves player-time and ignores non-squad actors', () => {
    const r = measureReadinessWindow([player([[0, 1], [777, 0], [2000, 2]]), player(), player([[0, 1]], false)], 'Stability', 1500, 1500, 3000);
    for (const interval of [r.before, r.after]) {
      expect(interval.presentMs + interval.absentMs + interval.unknownMs).toBe((interval.endMs - interval.startMs) * 2);
    }
  });
  it('returns no measured interval for invalid selection', () => {
    for (const center of [NaN, -1, 1000]) {
      expect(measureReadinessWindow([player([[0, 1]])], 'Stability', center, 100, 1000).after.totalMs).toBe(0);
    }
  });
});
describe('squad readiness', () => {
  it('reports when a source-resolution boundary changes the measured boon state', () => {
    const boundary = measureReadinessBoundary([player([[0, 0], [500, 1]])], [0, 999], 2000)!;
    expect(boundary.results[0]).toMatchObject({ name: 'Stability', observedCoverageRange: [0, 1], boundarySensitive: true,
      start: { present: 0, absent: 1 }, end: { present: 1, absent: 0 } });
  });
  it('rejects invalid boundary ranges instead of silently clamping them into evidence', () => {
    expect(measureReadinessBoundary([player([[0, 1]])], [-1, 999], 2000)).toBeNull();
    expect(measureReadinessBoundary([player([[0, 1]])], [2000, 2999], 2000)).toBeNull();
  });
  it('separates observed coverage from possible roster bounds', () => {
    const r = measureReadiness([player([[0, 2]]), player([[0, 0]]), player(), player([[0, 1]], false)], 500, 1000)[0];
    expect(r).toMatchObject({ total: 3, present: 1, absent: 1, unknown: 1, observedCoverage: .5, evidenceCoverage: 2 / 3, bounds: [1 / 3, 2 / 3] });
  });
  it('does not backfill before first observation or past fight end', () => {
    expect(measureReadiness([player([[500, 1]])], 499, 1000)[0].unknown).toBe(1);
    expect(measureReadiness([player([[0, 1]])], 1000, 1000)[0].unknown).toBe(1);
  });
  it('uses transitions at their exact timestamp regardless of input order', () => {
    const r = measureReadiness([player([[500, 0], [0, 1]])], 500, 1000)[0];
    expect(r.absent).toBe(1);
  });
  it('leaves conflicting or invalid latest states unknown', () => {
    for (const states of [[[0, 1], [0, 0]], [[0, 1], [500, -1]]] as [number, number][][]) {
      expect(measureReadiness([player(states)], 500, 1000)[0].unknown).toBe(1);
    }
  });
  it('does not invent percentages for empty denominators', () => {
    expect(measureReadiness([], 0, 1000)[0]).toMatchObject({ observedCoverage: null, evidenceCoverage: null, bounds: null });
    expect(measureReadiness([player()], 0, 1000)[0]).toMatchObject({ observedCoverage: null, bounds: [0, 1] });
  });
});
