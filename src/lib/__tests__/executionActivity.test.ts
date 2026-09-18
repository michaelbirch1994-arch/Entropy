import { describe, expect, it } from 'vitest';
import { executionActivity, summarizeExecutionActivity } from '../insight/executionActivity';
const actor = (points: unknown[], account = 'A') => ({ account, damage1S: [points] });
describe('raw execution activity candidates', () => {
  it('separates two activity windows without calling them engagements', () => {
    const r = executionActivity({ durationMS: 5000, players: [actor([0, 10, 20, 20, 30, 40])] });
    expect(r.candidates).toEqual([{startMs:0,endMs:2000,damage:20,bins:2},{startMs:3000,endMs:5000,damage:20,bins:2}]);
  });
  it('does not turn missing or coerced samples into quiet time', () => {
    const r = executionActivity({durationMS:4000,players:[actor([0,10,null,'20',30])]});
    expect(r.bins.map(b=>b.state)).toEqual(['activity','unknown','unknown','unknown']);
  });
  it('does not invent a spike on a counter reset', () => {
    const r = executionActivity({durationMS:3000,players:[actor([100,110,0,10])]});
    expect(r.bins.map(b=>b.state)).toEqual(['activity','unknown','activity']);
    expect(r.candidates).toHaveLength(2);
  });
  it('requires all roster members to have valid samples', () => {
    const r = executionActivity({durationMS:2000,players:[actor([0,10,20]),actor([0,0],'B')]});
    expect(r.bins[1]).toMatchObject({state:'unknown',observedPlayers:1,eligiblePlayers:2,damage:10});
  });
  it('does not double count duplicate identities or extrapolate final seconds', () => {
    const r = executionActivity({durationMS:1500,players:[actor([0,10]),actor([0,10])]});
    expect(r.duplicateAccounts).toBe(1); expect(r.bins[0].state).toBe('unknown');
    expect(r.unmeasuredTailMs).toBe(500); expect(r.bins).toHaveLength(1);
  });
  it('handles empty and oversized inputs without generating artificial windows', () => {
    expect(executionActivity(null).candidates).toEqual([]);
    expect(executionActivity({durationMS:1e12,players:[]}).unsupportedDuration).toBe(true);
  });
  it('persists compact pressure evidence without retaining raw bins', () => {
    const result = executionActivity({ durationMS: 5000, players: [actor([0, 10, 20, 5020, 5030, 5040])] });
    const summary = summarizeExecutionActivity(result);
    expect(summary.pressure.candidates).toEqual([{ startMs: 2000, endMs: 3000, damage: 5000, baseline: 10, excess: 4990, ratio: 500 }]);
    expect(summary.pressure.config).toMatchObject({ minimumDamage: 1000, minimumExcess: 1000, minimumRatio: 2 });
    expect(summary).not.toHaveProperty('bins');
  });
});
