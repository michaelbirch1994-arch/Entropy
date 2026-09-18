import { it, expect } from 'vitest';
import { EQUIPMENT_SLOTS, LOADOUT_FIELDS, parseLoadoutSnapshot, loadoutSnapshotAt } from '../insight/loadoutSnapshot';
const fixture = () => ({schemaVersion:2,kind:'loadout-baseline',sessionId:'synthetic',snapshotId:'one',account:'Fixture.1234',collectorVersion:'test',gameBuild:1,mode:'wvw',clock:{basis:'session-relative',observedMs:1000,uncertaintyMs:10},fields:Object.fromEntries(LOADOUT_FIELDS.map(k=>[k,{state:'unknown'} as unknown])),equipment:Object.fromEntries(EQUIPMENT_SLOTS.map(k=>[k,{state:'unknown'} as unknown]))});
const item = () => ({state:'value',source:'player-provided',item:{namespace:'gw2:item',id:123},stats:{state:'unknown'},upgrades:{state:'unequipped',source:'player-provided'},infusions:{state:'unknown'}});
it('round trips explicit unknown baseline',()=>{expect(parseLoadoutSnapshot(JSON.stringify(fixture()))).toEqual(fixture());});
it('rejects omitted fields and invented sources',()=>{
 const r=fixture(); delete r.fields.traits; expect(()=>parseLoadoutSnapshot(JSON.stringify(r))).toThrow();
 const s=fixture(); s.fields.traits={state:'value',source:'guessed',ids:[1]} as never; expect(()=>parseLoadoutSnapshot(JSON.stringify(s))).toThrow();
});
it('preserves repeat equipment IDs and declared provenance',()=>{
 const r=fixture(); r.equipment.ring1=item(); r.equipment.ring2=item();
 expect(parseLoadoutSnapshot(JSON.stringify(r)).equipment).toEqual(r.equipment);
});
it('rejects old inventories and missing slots',()=>{
 const r=fixture(); expect(()=>parseLoadoutSnapshot(JSON.stringify({...r,schemaVersion:1}))).toThrow();
 delete r.equipment.head; expect(()=>parseLoadoutSnapshot(JSON.stringify(r))).toThrow();
});
it('rejects wrong namespaces and hidden item data on unequipped slots',()=>{
 const r=fixture();
 for(const slot of [{...item(),item:{namespace:'gw2:skill',id:123}},{...item(),state:'unequipped'}, {...item(),stats:{state:'value',source:'player-provided',references:[{namespace:'gw2:item',id:456}]}}]) {
  r.equipment.head=slot; expect(()=>parseLoadoutSnapshot(JSON.stringify(r))).toThrow();
 }
});
it('links stat references to their item slot without guessing another set',()=>{
 const r=fixture(); r.equipment.weapon1Main={...item(),stats:{state:'value',source:'collector-observed',references:[{namespace:'gw2:itemstat',id:456}]}};
 const parsed=parseLoadoutSnapshot(JSON.stringify(r));
 expect(parsed.equipment.weapon1Main).toEqual(r.equipment.weapon1Main);
 expect(parsed.equipment.weapon2Main).toEqual({state:'unknown'});
});
it('rejects zero IDs and ambiguous empty values',()=>{
 for(const ids of [[0],[]]) { const r=fixture(); r.fields.healSkill={state:'value',source:'collector-observed',ids} as never; expect(()=>parseLoadoutSnapshot(JSON.stringify(r))).toThrow(); }
});
it('requires matching identity and explicit freshness without carrying future data backward',()=>{
 const r=parseLoadoutSnapshot(JSON.stringify(fixture())); const c={sessionId:'synthetic',account:'Fixture.1234',timeMs:1100,maximumAgeMs:200};
 expect(loadoutSnapshotAt(r,c).matched).toBe(true);
 expect(loadoutSnapshotAt(r,{...c,sessionId:'other'}).matched).toBe(false);
 expect(loadoutSnapshotAt(r,{...c,timeMs:1000}).matched).toBe(false);
 expect(loadoutSnapshotAt(r,{...c,timeMs:1300}).matched).toBe(false);
});
