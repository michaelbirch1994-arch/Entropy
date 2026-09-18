import { describe, expect, it } from 'vitest';
import { executionActivity } from '../insight/executionActivity';

const fixture = () => ({ durationMS: 2000, phases: [{ start: 0, end: 2000 }],
  targets: [{ enemyPlayer: true }, { enemyPlayer: false }, { enemyPlayer: true }],
  players: [{ account: 'fixture.1234', targetDamage1S: [[[0, 10, 20]], [[0, 900, 1800]], [[0, 5, 15]]] }] });
const measure = (raw: unknown) => executionActivity(raw, 'recorded-enemy-players');
describe('recorded enemy-player damage', () => {
  it('sums only explicitly selected target deltas', () => {
    const result = measure(fixture());
    expect(result.selectedTargetIndices).toEqual([0, 2]);
    expect(result.bins.map(b => b.damage)).toEqual([15, 20]);
  });
  it('does not let an increasing target conceal another target counter reset', () => {
    const raw = fixture(); raw.players[0].targetDamage1S[0][0] = [0, 10, 0];
    expect(measure(raw).bins[1].state).toBe('unknown');
  });
  it('rejects missing selected tracks and mismatched target dimensions', () => {
    const raw = fixture(); raw.players[0].targetDamage1S[2] = [];
    expect(measure(raw).bins.every(b => b.state === 'unknown')).toBe(true);
    raw.players[0].targetDamage1S.pop();
    expect(measure(raw).bins.every(b => b.state === 'unknown')).toBe(true);
  });
  it('requires a full-fight first phase', () => {
    const raw = fixture(); raw.phases[0].start = 500;
    expect(measure(raw).bins.every(b => b.state === 'unknown')).toBe(true);
  });
  it('does not invent zero damage when no enemy targets are identified', () => {
    const raw = fixture(); raw.targets = [];
    expect(measure(raw).bins.every(b => b.state === 'unknown')).toBe(true);
  });
  it('reports unknown classifications without treating them as enemies', () => {
    const raw = fixture();
    const result = measure({ ...raw, targets: [{}, ...raw.targets.slice(1)] });
    expect(result.unknownTargetClassifications).toBe(1);
    expect(result.selectedTargetIndices).toEqual([2]);
    expect(result.bins.map(b => b.damage)).toEqual([5, 10]);
  });
});
