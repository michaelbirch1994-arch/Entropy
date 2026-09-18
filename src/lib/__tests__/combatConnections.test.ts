import { describe, expect, it } from 'vitest';
import { buildCombatConnections, combatMomentBins, connectionWindow, effectSpans } from '../insight/combatConnections';
import type { WvWReport } from '../../types/report';

function fixture() {
  return { meta: {}, stats: {
    fightBreakdown: [{ id: 'other' }, { id: 'f1' }],
    offensePlayers: [{ account: 'A' }, { account: 'B' }],
    dpsGraph: { fights: [{ fightId: 'f1', fightName: 'One', durationMs: 6000, players: [{ account: 'A', profession: 'Druid', points: [0, 100, 300, 600] }, { account: 'B', profession: 'Druid', points: [0, 200] }] }] },
    rotations: { skillMeta: { 7: { name: 'Known cast' } }, fights: [{ fightId: 'other', players: [{ account: 'A', casts: [{ castTime: 2000, skillId: 999 }] }] }, { fightId: 'f1', durationMs: 6000, fightName: 'One', players: [{ account: 'A', casts: [{ castTime: 2000, skillId: 7 }] }] }] },
    mechanics: { fights: [{ fightId: 'f1', durationMs: 6000, fightName: 'One', mechanics: [{ def: { name: 'Control' }, events: [{ time: 2500, account: 'A' }, { time: 2600, account: 'B' }] }] }] },
    replayFights: [{ fightId: 'f1', fightName: 'One', data: { durationMs: 6000, players: [{ account: 'A', effects: [{ id: 1, name: 'Quickness', classification: 'Boon', states: [[1000, 1], [3000, 0]] }], downIntervals: [[3500, 4500]], deadIntervals: [] }] } }],
  } } as unknown as WvWReport;
}

describe('Combat connections', () => {
  it('joins by fight ID, preserves source values, and excludes other player events', () => {
    const report = fixture(); const before = JSON.stringify(report);
    const result = buildCombatConnections(report, 'f1', 'A')!;
    expect(result.fightIndex).toBe(1);
    expect(result.moments.map(e => e.label)).toEqual(['Known cast', 'Control', 'Downstate']);
    expect(result.provenance.map(source => source.kind)).toEqual([
      'recorded-event', 'recorded-event', 'parser-derived-state', 'parser-derived-state', 'parser-derived-state', 'bounded-inference',
    ]);
    expect(result.provenance.find(source => source.id === 'rotation-casts')?.detail).toContain('1 timestamped cast');
    expect(JSON.stringify(report)).toBe(before);
  });
  it('does not extend missing damage samples or infer a healing curve', () => {
    const result = buildCombatConnections(fixture(), 'f1', 'A')!;
    expect(result.output[3].dps).toBe(200);
    expect(result.output[3].peers).toBeNull();
    expect(result.output[4].dps).toBeNull();
    expect(result.coverage.healingTimeline).toBe(false);
  });
  it('keeps pre-observation boon states unknown and explicit zero distinct', () => {
    expect(effectSpans({ id: 1, name: 'Quickness', classification: 'Boon', states: [[1000, 1], [3000, 0]] }, 5000)).toEqual([{ start: 1000, end: 3000, value: 1 }, { start: 3000, end: 5000, value: 0 }]);
  });
  it('includes overlapping downstate and clips effects to the selected window', () => {
    const result = buildCombatConnections(fixture(), 'f1', 'A')!;
    const window = connectionWindow(result, 4400, 300);
    expect(window.events.map(e => e.kind)).toEqual(['down']);
    expect(window.effects[0].spans).toEqual([{ start: 4100, end: 4700, value: 0 }]);
  });
  it('does not assign another players timeline to a missing player', () => {
    const result = buildCombatConnections(fixture(), 'f1', 'missing')!;
    expect(result.hasDamage).toBe(false); expect(result.effects).toEqual([]); expect(result.moments).toEqual([]);
  });
  it('retains actor attribution when squad event scope is enabled', () => {
    const result = buildCombatConnections(fixture(), 'f1', 'A', true)!;
    expect(result.moments.filter(e => e.kind === 'mechanic').map(e => e.account)).toEqual(['A', 'B']);
    expect(connectionWindow(result, 2500, 500).eventScope).toBe('squad');
  });
  it('reuses immutable joins while keeping player and squad scopes separate', () => {
    const report = fixture();
    const player = buildCombatConnections(report, 'f1', 'A', false);
    expect(buildCombatConnections(report, 'f1', 'A', false)).toBe(player);
    expect(buildCombatConnections(report, 'f1', 'A', true)).not.toBe(player);
  });
  it('bounds timeline marks without dropping dense source events', () => {
    const moments = Array.from({ length: 1000 }, (_, index) => ({
      time: index * 600,
      label: `Cast ${index}`,
      kind: 'cast' as const,
    }));
    const bins = combatMomentBins(moments, 600_000);
    expect(bins.length).toBeLessThanOrEqual(120);
    expect(bins.flatMap(bin => bin.moments)).toEqual(moments);
  });
});
