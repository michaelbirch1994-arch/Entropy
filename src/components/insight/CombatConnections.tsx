import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine } from 'recharts';
import { ArrowUpRight, Clock3, Network, Crosshair, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import type { WvWReport } from '../../types/report';
import { buildCombatConnections, combatMomentBins, connectionFights, connectionWindow, type CombatMoment } from '../../lib/insight/combatConnections';
import { useView } from '../../store/ViewContext';
import { fmtCompact } from '../../utils/format';
import './CombatConnections.css';
import CombatMomentStory from './CombatMomentStory';
import type { ExecutionSelection } from './ExecutionSelection';

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const kinds = ['mechanic', 'cast', 'down', 'death'] as const;
const labels = { mechanic: 'Mechanics', cast: 'Skill casts', down: 'Downstate', death: 'Death' };

export default function CombatConnections({ report, account, selection }: { report: WvWReport; account: string; selection?: ExecutionSelection }) {
  const fights = useMemo(() => connectionFights(report), [report]);
  const [fightId, setFightId] = useState('');
  const selected = selection ? fights.find(f => f.id === selection.fightId) : fights.find(f => f.id === fightId) ?? fights[0];
  if (!selected) return <section className="connections-empty"><Network size={30}/><h2>No combat timelines recorded</h2><p>This report contains no timestamped combat data. Its existing metrics remain available.</p></section>;
  return <FightConnections key={`${selected.id}:${account}`} report={report} account={account} fightId={selected.id} fights={fights} onFight={selection?.setFight ?? setFightId} selection={selection}/>;
}

function FightConnections({ report, account, fightId, fights, onFight, selection }: {
  selection?: ExecutionSelection;
  report: WvWReport; account: string; fightId: string; fights: ReturnType<typeof connectionFights>;
  onFight: (id: string) => void;
}) {
  const [squadEvents, setSquadEvents] = useState(Boolean(selection));
  const model = useMemo(() => buildCombatConnections(report, fightId, account, squadEvents)!, [report, fightId, account, squadEvents]);
  const [localTime, setLocalTime] = useState(0);
  const time = selection?.timeMs ?? localTime;
  const setTime = selection?.setTime ?? setLocalTime;
  const [localRadius, setLocalRadius] = useState(5000);
  const radius = selection?.radiusMs ?? localRadius;
  const setRadius = selection?.setRadius ?? setLocalRadius;
  const [compare, setCompare] = useState(false);
  const [category, setCategory] = useState('Boon');
  const [shown, setShown] = useState(40);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(), elapsed = now - previous;
      previous = now;
      setTime(t => Math.min(model.fight.duration, t + elapsed * speed));
    }, 100);
    return () => clearInterval(timer);
  }, [playing, speed, model.fight.duration, setTime]);
  useEffect(() => { if (time >= model.fight.duration - 1) setPlaying(false); }, [time, model.fight.duration]);
  const { navigateToView } = useView();
  const window = useMemo(() => connectionWindow(model, time, radius), [model, time, radius]);
  const percent = (t: number) => `${Math.max(0, Math.min(100, t / model.fight.duration * 100))}%`;
  const cursor = <><div className="connection-window" style={{ left: percent(window.startMs), width: percent(window.endMs - window.startMs) }}/><div className="connection-cursor" style={{ left: percent(time) }}/></>;
  const outputNow = model.output.find(p => p.time === Math.floor(time / 1000) * 1000);
  const groups = useMemo(() => kinds.map(kind => {
    const bins = combatMomentBins(model.moments.filter(moment => moment.kind === kind), model.fight.duration);
    return { kind, bins };
  }), [model]);
  const effects = model.effects.filter(e => e.classification === category);
  const changeTime = (value: number) => { setPlaying(false); setTime(value); setShown(40); };
  const eventTimes = useMemo(() => [...new Set([...model.moments.map(m => m.time), ...model.effects.flatMap(e => e.spans.map(s => s.start))])].sort((a, b) => a - b), [model]);
  const previousEvent = eventTimes.filter(t => t < time - 1).at(-1);
  const nextEvent = eventTimes.find(t => t > time + 1);
  const inspectEvents = (events: CombatMoment[]) => changeTime(events[0].time);
  return <div data-shared={Boolean(selection)}><section className="combat-connections" aria-label="Combat connections">
    <header className="connections-title"><div><span><Network size={16}/> COMBAT CONNECTIONS</span><h2>The fight, connected.</h2></div><label>Fight<select aria-label="Connection fight" value={fightId} onChange={e => onFight(e.target.value)}>{fights.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label></header>
    <div className="connections-controls"><label><Clock3 size={15}/> Window<select aria-label="Connection window" value={radius} onChange={e => setRadius(Number(e.target.value))}><option value={3000}>+/- 3 seconds</option><option value={5000}>+/- 5 seconds</option><option value={10000}>+/- 10 seconds</option></select></label><label><input type="checkbox" checked={compare} disabled={!model.peerCount} onChange={e => setCompare(e.target.checked)}/> Same-profession mean ({model.peerCount})</label><span>Timing overlap, not proven causation</span></div>
    <label className="connections-squad-scope"><input type="checkbox" checked={squadEvents} onChange={e => setSquadEvents(e.target.checked)}/> Include squad casts, mechanics and survival events</label>
    <div className="connections-playback"><button type="button" title="Previous event" aria-label="Previous combat event" disabled={previousEvent === undefined} onClick={() => previousEvent !== undefined && changeTime(previousEvent)}><SkipBack size={16}/></button><button type="button" title={playing ? 'Pause' : 'Play'} aria-label={playing ? 'Pause combat playback' : 'Play combat playback'} onClick={() => { if (time >= model.fight.duration) setTime(0); setPlaying(p => !p); }}>{playing ? <Pause size={17}/> : <Play size={17}/>}</button><button type="button" title="Next event" aria-label="Next combat event" disabled={nextEvent === undefined} onClick={() => nextEvent !== undefined && changeTime(nextEvent)}><SkipForward size={16}/></button><select aria-label="Combat playback speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[0.5, 1, 2, 4].map(s => <option key={s} value={s}>{s}x</option>)}</select><span>{model.eventScope === 'squad' ? 'Squad events / selected player effects & damage' : 'Selected player events, effects & damage'}</span></div>
    <details className="execution-expand"><summary>Moment analysis</summary><CombatMomentStory model={model} time={time} radius={radius} profession={report.stats.offensePlayers?.find(p => p.account === account)?.profession} onTime={changeTime}/></details>
    <div className="connections-output"><div><span>PLAYER DAMAGE / 5s ROLLING DPS</span><strong>{outputNow?.dps == null ? 'Not recorded' : fmtCompact(outputNow.dps)}</strong></div><div><span>FOCUSED MOMENT</span><strong>{clock(time)}</strong></div></div>
    <div className="connections-chart" aria-label="Damage over time">
      {model.hasDamage ? <ResponsiveContainer width="100%" height="100%"><LineChart data={model.output} margin={{ top: 15, bottom: 4, left: 0, right: 0 }} onClick={state => { const value = Number(state?.activeLabel); if (Number.isFinite(value)) changeTime(value); }}><XAxis hide type="number" dataKey="time" domain={[0, model.fight.duration]}/><Tooltip labelFormatter={v => clock(Number(v))} formatter={(v, name) => [fmtCompact(Number(v)), name]} contentStyle={{ background: '#111b18', border: '1px solid #537767', borderRadius: 4, color: '#e4eee8' }}/><ReferenceArea x1={window.startMs} x2={window.endMs} fill="#83d9bc" fillOpacity={.08}/><ReferenceLine x={time} stroke="#e2bf71"/><Line type="linear" dataKey="dps" name="Player DPS" stroke="#6de4c6" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false}/>{compare && <Line type="linear" dataKey="peers" name="Profession mean DPS" stroke="#d4b46e" strokeWidth={1.5} dot={false} strokeDasharray="5 4" connectNulls={false} isAnimationActive={false}/>}</LineChart></ResponsiveContainer> : <p>No damage timeline recorded for this player.</p>}
    </div>
    <div className="connections-ruler">{[0, .25, .5, .75, 1].map(f => <span key={f}>{clock(model.fight.duration * f)}</span>)}</div>
    <label className="connections-scrub"><Crosshair size={16}/><input aria-label="Combat moment" type="range" min={0} max={model.fight.duration} step={100} value={time} onChange={e => changeTime(Number(e.target.value))}/><output>{clock(time)}</output></label>
    <div className="connections-lanes">{groups.map(({ kind, bins }) => <div className="connection-lane" key={kind}><span>{labels[kind]}</span><div className={`connection-track ${kind}`}>{cursor}{bins.map(({ index, moments }) => <button type="button" key={index} title={`${moments.map(m => `${clock(m.time)} ${m.label}`).slice(0, 4).join('\n')}${moments.length > 4 ? `\n${moments.length} events` : ''}`} aria-label={`${labels[kind]} at ${clock(moments[0].time)}, ${moments.length} events`} style={{ left: percent(moments[0].time), width: moments[0].end ? percent(Math.max(0, moments[0].end - moments[0].time)) : undefined }} onClick={() => inspectEvents(moments)}/>)}{!bins.length && <small>{(kind === 'cast' ? model.coverage.casts : kind === 'mechanic' ? model.coverage.mechanics : model.coverage.survival) ? 'No events recorded' : 'Timeline unavailable'}</small>}</div></div>)}</div>
    <details className="execution-expand"><summary>Player boons, conditions and healing context</summary>
    <div className="connections-effect-header"><div role="group" aria-label="Effect type">{['Boon', 'Condition'].map(c => <button type="button" key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c === 'Boon' ? 'Boons' : 'Conditions'}</button>)}</div><span>Filled: present / Outlined: zero / Hatched: unknown</span></div>
    <div className="connections-effects">{effects.map(effect => <div className="connection-lane" key={effect.id}><span>{effect.icon && <img src={effect.icon} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/>} {effect.name}</span><div className={`connection-track effect ${category.toLowerCase()}`}>{effect.spans.map((span, i) => <button type="button" key={i} data-active={span.value > 0} style={{ left: percent(span.start), width: percent(span.end - span.start) }} title={`${effect.name}: ${span.value} recorded state / ${clock(span.start)} - ${clock(span.end)}`} aria-label={`${effect.name}, state ${span.value}, at ${clock(span.start)}`} onClick={() => changeTime(span.start)}/>)}{cursor}</div></div>)}{!effects.length && <p>No timestamped {category.toLowerCase()} states recorded for this player.</p>}</div>
    <div className="connections-healing"><span>HEALING</span><strong>No timestamped healing series</strong><p>{model.healing ? `Recorded report-wide squad healing: ${fmtCompact(model.healing.healingTotals.squadHealing)}. Coverage: ${model.healing.healingCoverage ?? (model.healing.hasHealAddon ? 'full' : 'unknown')}. This total is not attributed to the selected fight or moment.` : 'No healing records available for this player.'}</p></div>
    </details>
    <section className="connections-window-details"><header><div><span>LINKED WINDOW</span><h3>{clock(window.startMs)} - {clock(window.endMs)}</h3></div><div>{model.fightIndex >= 0 && <button type="button" onClick={() => navigateToView('fight-replay', { source: 'other', fightId, fightIndex: model.fightIndex, timestampMs: time, account })}>Replay <ArrowUpRight size={14}/></button>}</div></header>
      <div className="connection-event-list">{window.events.slice(0, shown).map((m, i) => <button type="button" key={i} onClick={() => inspectEvents([m])}><time>{clock(m.time)}</time><span className={`connection-event-kind ${m.kind}`}>{labels[m.kind]}</span><strong>{m.label}{squadEvents && <small>{m.account}</small>}</strong></button>)}{!window.events.length && <p>No recorded events in this window.</p>}</div>{window.events.length > shown && <button type="button" className="connections-more" onClick={() => setShown(n => n + 40)}>Show more ({window.events.length - shown})</button>}
    </section>
    <p className="connections-note">Damage is a rolling rate. Profession peers can have different builds and roles. Unrecorded data is unknown.</p>
  </section></div>;
}
