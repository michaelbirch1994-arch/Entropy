import { expect, it } from 'vitest';
import { EQUIPMENT_SLOTS, LOADOUT_FIELDS, parseLoadoutSnapshot, selectLoadoutSnapshot, type LoadoutSelectionContext } from '../insight/loadoutSnapshot';
const snapshot = (time: number, id = String(time)) => parseLoadoutSnapshot(JSON.stringify({ schemaVersion:2,kind:'loadout-baseline',sessionId:'s',snapshotId:id,account:'Fixture.1234',collectorVersion:'test',gameBuild:1,mode:'wvw',clock:{basis:'session-relative',observedMs:time,uncertaintyMs:0},fields:Object.fromEntries(LOADOUT_FIELDS.map(k=>[k,{state:'unknown'}])),equipment:Object.fromEntries(EQUIPMENT_SLOTS.map(k=>[k,{state:'unknown'}])) }));
const context: LoadoutSelectionContext = {sessionId:'s',account:'Fixture.1234',gameBuild:1,mode:'wvw',timeMs:3000,maximumAgeMs:5000,gaps:[]};
it('selects latest baseline independent of array order',()=>{
 const newest=snapshot(2000);
 expect(selectLoadoutSnapshot([newest,snapshot(1000)],context)).toMatchObject({status:'snapshot',snapshot:newest,ageMs:1000});
});
it('keeps older fields unknown when a newer full baseline no longer observes them',()=>{
 const old=snapshot(1000); old.fields.healSkill={state:'value',source:'player-provided',ids:[123]};
 const result=selectLoadoutSnapshot([old,snapshot(2000)],context);
 expect(result.status==='snapshot' && result.snapshot.fields.healSkill).toEqual({state:'unknown'});
});
it('blocks stale or gap-crossing baselines, then accepts a fresh post-gap one',()=>{
 expect(selectLoadoutSnapshot([snapshot(1000)],{...context,maximumAgeMs:500}).status).toBe('unknown');
 const c={...context,gaps:[{startMs:1500,endMs:2000}]};
 expect(selectLoadoutSnapshot([snapshot(1000)],c).status).toBe('unknown');
 expect(selectLoadoutSnapshot([snapshot(1000),snapshot(2100)],c).status).toBe('snapshot');
 expect(selectLoadoutSnapshot([snapshot(2000)],c).status).toBe('unknown');
});
it('does not fall back through uncertain newer observations',()=>{
 const newer=snapshot(3100); newer.clock.uncertaintyMs=200;
 expect(selectLoadoutSnapshot([snapshot(1000),newer],context).status).toBe('unknown');
 expect(selectLoadoutSnapshot([snapshot(1000),snapshot(4000)],context).status).toBe('snapshot');
});
it('rejects overlapping observation times and duplicate latest identity',()=>{
 const newer=snapshot(2100); newer.clock.uncertaintyMs=200;
 expect(selectLoadoutSnapshot([snapshot(2000),newer],context).status).toBe('unknown');
 expect(selectLoadoutSnapshot([snapshot(2000,'same'),snapshot(1000,'same')],context).status).toBe('unknown');
});
it('never borrows identity, mode or build from another context',()=>{
 expect(selectLoadoutSnapshot([snapshot(1000)],{...context,sessionId:'other'}).status).toBe('unknown');
 for(const patch of [{gameBuild:2},{mode:'pve' as const}]) {
  expect(selectLoadoutSnapshot([snapshot(1000),{...snapshot(2000),...patch}],context).status).toBe('unknown');
 }
});
it('rejects malformed gaps',()=>{
 expect(selectLoadoutSnapshot([snapshot(1000)],{...context,gaps:[{startMs:2000,endMs:1000}]}).status).toBe('unknown');
});
