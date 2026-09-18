import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditExecutionInput } from './audit-execution-input.mjs';
test('tracks actual replay source and detects conflicting/invalid states', () => {
 const r = auditExecutionInput({ players: [{buffUptimes:[{id:1,states:[[0,1],[0,0],[2,-1]]}]}, {buffUptimesActive:[{id:1,states:[[0,1]]}]}, {notInSquad:true,buffUptimes:[{id:1,states:[[0,1]]}]}], buffMap:{b1:{name:'Stability',classification:'Boon'}} });
 assert.equal(r.roster,2); assert.equal(r.boons[0].tracked,1); assert.equal(r.boons[0].statesAtZero,1);
 assert.equal(r.boons[0].malformedStates,1); assert.equal(r.boons[0].conflictingTimes,1);
});
test('does not infer timeline availability from aggregate uptime or names alone', () => {
 const r = auditExecutionInput({players:[{buffUptimes:[{id:1,buffData:[{uptime:100}],states:[[0,1]]}]}],buffMap:{b1:{name:'Stability'}}});
 assert.equal(r.boons[0].tracked,0); assert.equal(r.boons[0].missingClassification,1);
 assert.equal(r.playersWithCasts,0);
});
