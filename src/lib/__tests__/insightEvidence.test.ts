import { describe, expect, it } from 'vitest';
import { buildInsightEvidence } from '../insight/evidence';
import type { WvWReport } from '../../types/report';

describe('Insight evidence isolation', () => {
  it('does not change report metrics and preserves unknown healing coverage and boon units', () => {
    const report = { meta: { title: 'Test' }, stats: {
      offensePlayers: [{ account: 'A', offenseTotals: { damage: 123 }, totalFightMs: 1000 }],
      healingPlayers: [{ account: 'A', hasHealAddon: false, healingTotals: { squadHealing: 10 } }],
      boonUptimes: { columns: [{ id: 1, name: 'Might', stacking: true }, { id: 2, name: 'Quickness' }], rows: [{ account: 'A', uptimes: { 1: 12 } }] },
    } } as unknown as WvWReport;
    const before = JSON.stringify(report);
    const evidence = buildInsightEvidence(report, 'A');
    expect(JSON.stringify(report)).toBe(before);
    expect(evidence.find(e => e.label === 'Healing and recording coverage')?.data).toMatchObject({ healingCoverage: 'unknown' });
    expect(evidence.find(e => e.label.startsWith('Received boons'))?.data).toMatchObject({ boons: [{ name: 'Might', value: 12, unit: 'average stacks' }, { name: 'Quickness', value: null, unit: 'percent' }] });
    expect(new Set(evidence.map(e => e.id)).size).toBe(evidence.length);
  });
  it('only includes the selected player death records and preserves replay timing', () => {
    const report = { meta: {}, stats: { deathRecaps: [{ account: 'A', fightIndex: 3, deathTimeMs: 14000 }, { account: 'B', fightIndex: 0, deathTimeMs: 2000 }] } } as unknown as WvWReport;
    const deaths = buildInsightEvidence(report, 'A').filter(e => e.label === 'Recorded death recap');
    expect(deaths).toHaveLength(1);
    expect(deaths[0].replay).toEqual({ account: 'A', fightIndex: 3, timestampMs: 14000 });
  });
});
