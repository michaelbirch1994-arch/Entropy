import { expect, it } from 'vitest';
import { buildRawStory } from '../insight/rawStory';
import { parseRawCapture, type RawEncounterMatch } from '../insight/rawCapture';
it('restricts story to area observations in the supplied window and retains all counts', () => {
  const capture = parseRawCapture(JSON.stringify({type:'header',format:'entropy-arc-callbacks',version:1}), 'test');
  capture.events = [200, 100, 300, 99].map((tick, index) => ({ sequence:String(index), stream:'area',kind:'Down',tick,skillId:0,sourceId:'1',details:{} }));
  capture.events.push({...capture.events[0],sequence:'local',stream:'local'});
  const match: RawEncounterMatch = {name:'test',status:'start-matched',recorder:null,startTick:100,endTick:300,exactEnd:false};
  const story = buildRawStory(capture,match)!;
  expect(story.events.map(e=>e.tick)).toEqual([100,200,300]);
  expect(story.bins[2].reduce((sum,b)=>sum+b.count,0)).toBe(3);
  expect(story.bins[2][79].count).toBe(1);
  expect(buildRawStory(capture,{...match,status:'unmatched'})).toBeNull();
  expect(buildRawStory(capture,{...match,endTick:null})).toBeNull();
});
