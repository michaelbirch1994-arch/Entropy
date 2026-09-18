import { useMemo, useState } from 'react';
import { Activity, Shield, Skull, Zap } from 'lucide-react';
import type { RawCapture } from '../../lib/insight/rawCapture';
import { buildRawStory, storyLane, storyLanes } from '../../lib/insight/rawStory';

const time = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
export default function RawCombatStory({ capture }: { capture: RawCapture }) {
  const [name, setName] = useState('');
  const [selection, setSelection] = useState<{ name: string; ms: number; lane: string } | null>(null);
  const [page, setPage] = useState(0);
  const encounters = capture.encounterMatches.filter(m => m.status === 'start-matched' && m.endTick !== null);
  const encounter = encounters.find(m => m.name === name) ?? encounters[0];
  const story = useMemo(() => encounter ? buildRawStory(capture, encounter) : null, [capture, encounter]);
  const active = selection?.name === encounter?.name ? selection : null;
  const nearby = useMemo(() => story && active ? story.events.filter(e => Math.abs(e.tick! - story.start - active.ms) <= 5000) : [], [story, active]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(nearby.length / 50) - 1));
  return <section className="raw-story" aria-label="Combat Story">
    <div className="raw-actions"><h2><Activity size={20}/>Combat Story</h2><select aria-label="Story encounter" value={encounter?.name ?? ''} disabled={!encounters.length} onChange={e => { setName(e.target.value); setSelection(null); setPage(0); }}><option value="" disabled>Choose a matched encounter</option>{encounters.map(m => <option key={m.name}>{m.name}</option>)}</select></div>
    {!story ? <p>Check a combat log above to reveal its recorded event timeline.</p> : <>
      <p className="raw-note">Area observations only · Time since matched EVTC start, not verified report phase time · {encounter.exactEnd ? 'End bytes matched' : 'End alignment unverified'}</p>
      <p className="raw-error">{capture.retention?.savedPercent != null ? `${capture.retention.savedPercent.toFixed(2)}% of session callbacks retained. ` : 'Session retention unverified. '}Empty intervals do not prove inactivity. Events shown together are not proven causes.</p>
      <div className="raw-story-layout"><div>
        {story.bins.map((bins, lane) => { const Icon = [Zap, Shield, Skull][lane]; const max = Math.max(1, ...bins.map(b => b.count)); return <div className="raw-story-lane" key={lane}><div><Icon size={16}/><strong>{storyLanes[lane]}</strong><span>{bins.reduce((sum, b) => sum + b.count, 0).toLocaleString()}</span></div><div className="raw-story-bins">{bins.map(bin => <button key={bin.index} disabled={!bin.count} title={`${bin.lane}: ${bin.count} observations at ${time(bin.startMs)}`} aria-label={`${bin.lane}: ${bin.count} observations at ${time(bin.startMs)}`} onClick={() => { setSelection({ name: encounter.name, ms: bin.startMs, lane: bin.lane }); setPage(0); }}><span style={{ height: `${bin.count ? Math.max(12, bin.count / max * 100) : 0}%` }}/></button>)}</div></div>; })}
        <div className="raw-story-axis"><span>0s</span><span>{time(story.duration / 2)}</span><span>{time(story.duration)}</span></div>
        <p className="raw-note">80 count bins per lane; heights normalized within each lane.</p>
        <details><summary>Down and death observations</summary><div className="raw-story-events">{story.events.filter(e => storyLane(e.kind) === 'Downs / deaths').map(e => <button key={e.sequence} onClick={() => { setSelection({ name: encounter.name, ms: e.tick! - story.start, lane: e.kind }); setPage(0); }}><Skull size={14}/>{time(e.tick! - story.start)} · {e.kind} · Source {e.sourceId}</button>)}</div></details>
      </div><aside aria-label="Nearby recorded events"><h3>{active ? `${active.lane} · ${time(active.ms)}` : 'Event context'}</h3>{!active ? <p>Select a populated timeline bin or a down/death observation.</p> : <><p>±5 seconds · {nearby.length.toLocaleString()} observations · All recorded actors, identities unresolved</p><div className="raw-story-context">{nearby.slice(currentPage * 50, currentPage * 50 + 50).map(e => <div key={e.sequence}><strong>{time(e.tick! - story.start)} · {e.kind}</strong><span>Skill {e.skillId || 'unknown'} · Source {e.sourceId}</span>{Object.entries(e.details).map(([label, value]) => <small key={label}>{label}: {value}</small>)}</div>)}</div><div className="raw-actions"><button disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</button><span>{currentPage + 1}/{Math.max(1, Math.ceil(nearby.length / 50))}</span><button disabled={(currentPage + 1) * 50 >= nearby.length} onClick={() => setPage(currentPage + 1)}>Next</button></div></>}</aside></div>
    </>}
  </section>;
}
