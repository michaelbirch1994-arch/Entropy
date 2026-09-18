import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import type { WvWReport } from '../../types/report';
import { connectionFights } from '../../lib/insight/combatConnections';
import CombatConnections from './CombatConnections';
import { Activity, Crosshair, Search, Settings2, Users } from 'lucide-react';
import './SquadExecution.css';
import PlayerLoadoutInspector from './PlayerLoadoutInspector';
import { executionAnchors, preferredExecutionAnchor } from '../../lib/insight/execution/executionAnchors';

const UtilityEffectiveness = lazy(() => import('./UtilityEffectiveness'));

function DeferredUtilityEffectiveness({ report, fightId, onPlayer, onMoment }: {
  report: WvWReport;
  fightId: string;
  onPlayer: (account: string) => void;
  onMoment: (account: string, skillId: number | null, eventTimeMs: number) => void;
}) {
  const boundaryRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const boundary = boundaryRef.current;
    if (!boundary || typeof IntersectionObserver === 'undefined') {
      setReady(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setReady(true);
      observer.disconnect();
    }, { rootMargin: '700px 0px' });
    observer.observe(boundary);
    return () => observer.disconnect();
  }, []);

  return <div ref={boundaryRef} className="execution-deferred-utility">
    {ready ? <Suspense fallback={<div className="execution-deferred-skeleton" aria-label="Loading utility analysis" />}>
      <UtilityEffectiveness report={report} fightId={fightId} onPlayer={onPlayer} onMoment={onMoment}/>
    </Suspense> : <div className="execution-deferred-skeleton" aria-hidden="true" />}
  </div>;
}

export default function SquadExecution({ report }: { report: WvWReport }) {
  const fights = useMemo(() => connectionFights(report), [report]);
  const [fightId, setFightId] = useState('');
  const fight = fights.find(f => f.id === fightId) ?? fights[0];
  const [time, setTime] = useState(0);
  const [radiusMs, setRadius] = useState(3000);
  const [anchorId, setAnchorId] = useState('manual');
  const [account, setAccount] = useState('');
  const [inspectPlayer, setInspectPlayer] = useState(true);
  const [inspectSkillId, setInspectSkillId] = useState<number | null>(null);
  useEffect(() => { setFightId(''); setAccount(''); setInspectPlayer(true); setInspectSkillId(null); }, [report]);
  const maxTime = Math.max(0, (fight?.duration ?? 1) - 1);
  const anchors = useMemo(() => executionAnchors(report, fight?.id ?? '').filter(anchor => anchor.kind !== 'damage-pressure'), [report, fight?.id]);
  useEffect(() => {
    const preferred = preferredExecutionAnchor(anchors);
    setAnchorId(preferred.id);
    setTime(Math.min(preferred.timeMs, maxTime));
  }, [anchors, maxTime]);
  const changeTime = useCallback((update: SetStateAction<number>) => setTime(t => {
    setAnchorId('manual');
    const next = typeof update === 'function' ? update(t) : update;
    return Number.isFinite(next) ? Math.max(0, Math.min(maxTime, next)) : 0;
  }), [maxTime]);
  const players = useMemo(() => {
    const entries = new Map<string, string>();
    for (const p of report.stats.rotations?.fights.find(f => f.fightId === fight?.id)?.players ?? []) entries.set(p.account, p.account);
    for (const p of report.stats.dpsGraph?.fights.find(f => f.fightId === fight?.id)?.players ?? []) entries.set(p.account, p.account);
    for (const p of report.stats.replayFights?.find(f => f.fightId === fight?.id)?.data.players ?? []) {
      if (p.inSquad === false) entries.delete(p.account); else entries.set(p.account, `${p.name || p.account} · ${p.profession}`);
    }
    return [...entries].filter(([id]) => Boolean(id));
  }, [report, fight]);
  const focused = players.find(([id]) => id === account)?.[0] ?? players[0]?.[0];
  if (!fight) return <p>No timestamped combat data is available in this report. Existing metrics remain available.</p>;
  const selectedAnchor = anchors.find(anchor => anchor.id === anchorId) ?? anchors[0];
  const activeAnchor = selectedAnchor.kind === 'manual' ? { ...selectedAnchor, timeMs: Math.min(time, maxTime) } : selectedAnchor;
  const selection = { fightId: fight.id, timeMs: Math.min(time, maxTime), radiusMs, anchor: activeAnchor, setTime: changeTime, setRadius,
    setFight: (id: string) => setFightId(id) };
  const chooseAnchor = (id: string) => {
    const next = anchors.find(anchor => anchor.id === id);
    if (!next) return;
    setAnchorId(next.id);
    if (next.kind !== 'manual') setTime(Math.min(next.timeMs, maxTime));
  };
  const inspectResponseSkill = useCallback((playerAccount: string, skillId: number | null, eventTimeMs: number) => {
    setAccount(playerAccount);
    setInspectPlayer(true);
    setInspectSkillId(skillId ?? 0);
    changeTime(eventTimeMs);
  }, [changeTime]);
  return <div className="squad-execution">
    <header className="execution-overview">
      <div><span className="execution-step">01</span><span className="execution-kicker"><Activity size={15}/> SELECT A COMBAT MOMENT</span><h2>{fight.name}</h2></div>
      <dl><div><dt><Crosshair size={14}/> Selected moment</dt><dd>{Math.floor(selection.timeMs / 60000)}:{String(Math.floor(selection.timeMs / 1000) % 60).padStart(2, '0')}<small>.{String(Math.floor(selection.timeMs % 1000)).padStart(3, '0')}</small></dd></div><div><dt><Users size={14}/> Timeline players</dt><dd>{players.length}</dd></div></dl>
    </header>
    <section className="execution-context" aria-label="Shared combat selection">
      <div className="readiness-controls execution-primary-controls">
        <label>Fight<select aria-label="Execution fight" value={fight.id} onChange={e => selection.setFight(e.target.value)}>{fights.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <label>Analysis anchor<select aria-label="Execution analysis anchor" value={anchorId} onChange={e => chooseAnchor(e.target.value)}>{anchors.map(anchor => <option key={anchor.id} value={anchor.id}>{anchor.label}</option>)}</select></label>
      </div>
      <details className="execution-settings">
        <summary><Settings2 size={15}/><span>Analysis settings</span><small>{(selection.timeMs / 1000).toFixed(1)}s · ±{radiusMs / 1000}s window</small></summary>
        <div className="readiness-controls">
          <label>Exact time (seconds)<input type="number" min={0} max={maxTime / 1000} step="0.1" value={selection.timeMs / 1000} onChange={e => changeTime(Number(e.target.value) * 1000)}/></label>
          <label>Window each side<select value={radiusMs} onChange={e => setRadius(Number(e.target.value))}>{[1000,3000,5000,10000].map(ms => <option key={ms} value={ms}>{ms / 1000} seconds</option>)}</select></label>
        </div>
      </details>
    </section>
    <header className="execution-investigation-heading">
      <div><span className="execution-step">02</span><span className="execution-kicker"><Search size={15}/> INSPECT THE MOMENT</span><h2>Player palette and combat evidence</h2><p>Connect modeled cooldown state to recorded mechanics, casts, and defensive outcomes.</p></div>
      <div className="execution-player-focus"><label>Focused player<select value={focused ?? ''} disabled={!players.length} onChange={e => { setAccount(e.target.value); setInspectSkillId(null); }}>{players.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>{focused && <button type="button" onClick={() => setInspectPlayer(true)}><Search size={15}/> Open skill palette</button>}</div>
    </header>
    <div className="execution-investigation-grid">
      <section aria-label="Player drill-down" className="execution-drilldown">
        <div className="execution-player-workspace" data-inspecting={inspectPlayer && Boolean(focused)}>
        {focused ? <CombatConnections report={report} account={focused} selection={selection}/> : <p>No player timelines are available for this fight.</p>}
        {focused && inspectPlayer && <PlayerLoadoutInspector key={`${fight.id}:${focused}:${inspectSkillId ?? 'default'}`} report={report} account={focused} fightId={fight.id} timeMs={selection.timeMs} initialSkillId={inspectSkillId || undefined} onTime={changeTime} onClose={() => setInspectPlayer(false)}/>}
        </div>
      </section>
    </div>
    <DeferredUtilityEffectiveness report={report} fightId={fight.id} onPlayer={id => { setAccount(id); setInspectPlayer(true); setInspectSkillId(null); }} onMoment={inspectResponseSkill}/>
  </div>;
}
