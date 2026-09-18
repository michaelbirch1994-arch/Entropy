import { expect, it } from 'vitest';
import { executionBursts } from '../insight/executionBursts';
import type { ActivityBin } from '../insight/executionActivity';
const config = { baselineBinsEachSide: 2, minimumDamage: 100, minimumExcess: 50, minimumRatio: 2 };
const bins = (values: (number | null)[]): ActivityBin[] => values.map((damage, i) => ({ startMs: i * 1000, endMs: (i + 1) * 1000, damage, state: damage === null ? 'unknown' : damage > 0 ? 'activity' : 'quiet', eligiblePlayers: 1, observedPlayers: damage === null ? 0 : 1 }));
it('measures a prominent local peak against surrounding median', () => {
 expect(executionBursts(bins([10,20,200,20,10]),config).candidates).toEqual([{startMs:2000,endMs:3000,damage:200,baseline:15,excess:185,ratio:200/15}]);
});
it('does not call sustained damage or a plateau a burst', () => {
 expect(executionBursts(bins([100,100,100,100,100]),config).candidates).toEqual([]);
 expect(executionBursts(bins([0,0,200,200,0,0]),config).candidates).toEqual([]);
});
it('rejects incomplete neighborhoods and prevents zero-baseline division', () => {
 expect(executionBursts(bins([null,0,200,0,0]),config).candidates).toEqual([]);
 expect(executionBursts(bins([0,0,200,0,0]),config).candidates[0].ratio).toBe(null);
 expect(executionBursts(bins([0,0,1,0,0]),config).candidates).toEqual([]);
});
it('keeps separate peaks rather than a single fight maximum', () => {
 expect(executionBursts(bins([0,0,200,0,0,0,300,0,0]),config).candidates).toHaveLength(2);
});
it('rejects invalid thresholds and discontinuous time', () => {
 expect(()=>executionBursts([], {...config,minimumRatio:1})).toThrow();
 const b=bins([0,0,200,0,0]); b[0].endMs=500;
 expect(executionBursts(b,config).candidates).toEqual([]);
});
