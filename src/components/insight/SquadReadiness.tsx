import { useMemo, useState } from 'react';
import { ArrowUpRight, ShieldCheck, Shield, Footprints, Anchor } from 'lucide-react';
import type { WvWReport } from '../../types/report';
import type { InsightEvidence } from '../../lib/insight/evidence';
import { measureReadiness, measureReadinessBoundary, measureReadinessWindow } from '../../lib/insight/readiness';
import { classIconSrc } from '../../data/classIconAssets';
import './SquadReadiness.css';
import type { ExecutionSelection } from './ExecutionSelection';

const percent = (v: number | null) => v === null ? 'Unknown' : `${Math.round(v * 100)}%`;
const boonIcons = { Stability: Anchor, Protection: Shield, Aegis: ShieldCheck, Swiftness: Footprints };
export default function SquadReadiness({ report, onReplay, selection, focusedAccount, onPlayer }: {
  focusedAccount?: string;
  onPlayer?: (account: string) => void;
  selection?: ExecutionSelection;
  report: WvWReport;
  onReplay: (target: NonNullable<InsightEvidence['replay']>) => void;
}) {
  const fights = report.stats.replayFights ?? [];
  const [fightId, setFightId] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [boon, setBoon] = useState('Stability');
  const [localRadius, setRadiusSeconds] = useState(3);
  const radiusSeconds = selection ? selection.radiusMs / 1000 : localRadius;
  const fight = selection ? fights.find(f => f.fightId === selection.fightId) : fights.find(f => f.fightId === fightId) ?? fights[0];
  const timeMs = selection ? selection.timeMs : Math.min(seconds * 1000, Math.max(0, (fight?.data.durationMs ?? 1) - 1));
  const results = useMemo(() => measureReadiness(fight?.data.players ?? [], timeMs, fight?.data.durationMs ?? 0), [fight, timeMs]);
  const comparisons = useMemo(() => results.map(result => ({
    name: result.name,
    snapshot: result,
    continuity: measureReadinessWindow(fight?.data.players ?? [], result.name, timeMs, radiusSeconds * 1000, fight?.data.durationMs ?? 0),
  })), [results, fight, timeMs, radiusSeconds]);
  const selected = results.find(r => r.name === boon)!;
  const window = comparisons.find(comparison => comparison.name === boon)!.continuity;
  const fightIndex = report.stats.fightBreakdown?.findIndex(f => f.id === fight?.fightId) ?? -1;
  const account = selected.members[0]?.account;
  const replay = fightIndex >= 0 && account ? { fightIndex, timestampMs: timeMs, account } : undefined;
  const anchor = selection?.anchor;
  const boundary = useMemo(() => measureReadinessBoundary(fight?.data.players ?? [], anchor?.timeBoundsMs, fight?.data.durationMs ?? 0), [fight, anchor?.timeBoundsMs]);
  const selectedBoundary = boundary?.results.find(result => result.name === boon);
  const selectionDescription = anchor?.kind === 'damage-activity'
    ? `Calculated ${anchor.scope === 'recorded-enemy-players' ? 'enemy-player' : 'all-target'} damage-activity start at ${anchor.resolutionMs ?? 1000}ms source resolution; candidate boundary, not a detected engagement`
    : 'User-selected time, not a detected engagement';
  if (!fight) return <section className="squad-readiness"><h2>Squad boon state</h2><p>No replay boon timelines are available in this report. Aggregate uptime cannot establish state at a selected moment.</p></section>;
  return <section className="squad-readiness" data-shared={Boolean(selection)} aria-label="Squad readiness">
    <header><ShieldCheck size={24}/><div><h2>Squad boon state</h2><p>Before · selected moment · after · {selected.total} recorded squad members</p></div></header>
    <div className="readiness-controls">{!selection && <><label>Fight<select value={fight.fightId} onChange={e => { setFightId(e.target.value); setSeconds(0); }}>{fights.map(f => <option key={f.fightId} value={f.fightId}>{f.fightName}</option>)}</select></label><label>Analysis time (seconds)<input type="number" min="0" max={Math.max(0, (fight.data.durationMs - 1) / 1000)} step="0.1" value={timeMs / 1000} onChange={e => setSeconds(Math.max(0, Number(e.target.value) || 0))}/></label></>}{replay && <button type="button" onClick={() => onReplay(replay)}>View replay <ArrowUpRight size={15}/></button>}</div>
    <p className="readiness-note">{selectionDescription}. Roster membership at this exact moment is unverified.</p>
    <input className="readiness-scrubber" aria-label="Analysis time scrubber" type="range" min="0" max={Math.max(0, (fight.data.durationMs - 1) / 1000)} step="0.1" value={timeMs / 1000} onChange={e => selection ? selection.setTime(Number(e.target.value) * 1000) : setSeconds(Number(e.target.value))}/>
    <div className="readiness-matrix" role="list" aria-label={`Boon state comparison using ${radiusSeconds} seconds before and after the selected moment`}>
      <div className="readiness-matrix-head" aria-hidden="true"><span>Boon</span><span>Before</span><span>At moment</span><span>After</span></div>
      {comparisons.map(({ name, snapshot, continuity }) => { const Icon = boonIcons[name]; return <button type="button" role="listitem" key={name} data-boon={name} aria-pressed={boon === name} onClick={() => setBoon(name)}>
        <strong><Icon size={16}/><span>{name}</span></strong>
        <span><b>{continuity.before.endMs === continuity.before.startMs ? '—' : percent(continuity.before.observedCoverage)}</b><small>{continuity.before.endMs === continuity.before.startMs ? 'No interval' : `${percent(continuity.before.evidenceCoverage)} known`}</small></span>
        <span className="is-moment"><b>{percent(snapshot.observedCoverage)}</b><small>{snapshot.present}/{snapshot.present + snapshot.absent} present</small></span>
        <span><b>{continuity.after.endMs === continuity.after.startMs ? '—' : percent(continuity.after.observedCoverage)}</b><small>{continuity.after.endMs === continuity.after.startMs ? 'No interval' : `${percent(continuity.after.evidenceCoverage)} known`}</small></span>
      </button>; })}
      <footer><span>Known player-time across ±{radiusSeconds.toFixed(1)}s</span><span>Snapshot at {(timeMs / 1000).toFixed(1)}s</span></footer>
    </div>
    <div className="readiness-detail"><h3>{boon} evidence</h3><p>At the selected moment: <strong>{selected.present} present</strong> · {selected.absent} absent · {selected.unknown} unknown · Evidence coverage <strong>{percent(selected.evidenceCoverage)}</strong> · Possible roster range <strong>{selected.bounds ? `${percent(selected.bounds[0])}–${percent(selected.bounds[1])}` : 'Unknown'}</strong></p><div className="readiness-bar" aria-label={`${selected.present} present, ${selected.absent} absent, ${selected.unknown} unknown`}><i style={{ flex: selected.present }} /><i style={{ flex: selected.absent }}/><i style={{ flex: selected.unknown }}/></div>
    <p className="readiness-note">{selected.present} present · {selected.absent} absent · {selected.unknown} unknown. Last recorded transitions are used; recording gaps may not be represented.</p>
    {selectedBoundary && <div className="readiness-boundary" data-sensitive={selectedBoundary.boundarySensitive}><span>{selectedBoundary.boundarySensitive ? 'BOUNDARY-SENSITIVE' : 'BOUNDARY-STABLE'}</span><p>Across the possible activity boundary, known-state {boon} coverage is <strong>{selectedBoundary.observedCoverageRange ? `${percent(selectedBoundary.observedCoverageRange[0])}–${percent(selectedBoundary.observedCoverageRange[1])}` : 'unknown'}</strong>. {selectedBoundary.boundarySensitive ? 'The recorded squad state changes inside this one-second bin.' : 'The recorded present / absent / unknown counts do not change inside this bin.'}</p></div>}
    <details className="execution-expand"><summary>Player timelines and exact evidence</summary>
    <section className="readiness-continuity" aria-label={`${boon} player timelines`}>
      {!selection && <div className="readiness-window-heading"><label>Window each side<select value={radiusSeconds} onChange={e => setRadiusSeconds(Number(e.target.value))}>{[1, 3, 5].map(s => <option value={s} key={s}>{s} seconds</option>)}</select></label></div>}
      <div className="readiness-tracks">{window.members.map((p, i) => <div className="readiness-track-row" key={`${p.account}-${i}`}><span title={p.account}>{p.name || p.account}</span><div className="readiness-track" aria-label={`${p.name || p.account} ${boon} timeline`}>
        {p.spans.map((span, j) => <span key={j} data-state={span.state} style={{ flex: span.endMs - span.startMs }} title={`${span.state}: ${(span.startMs / 1000).toFixed(3)}–${(span.endMs / 1000).toFixed(3)}s`} />)}
        {window.endMs > window.startMs && <i style={{ left: `${100 * (window.centerMs - window.startMs) / (window.endMs - window.startMs)}%` }} />}
      </div><span className="readiness-track-summary">{(p.spans.filter(s => s.state === 'present').reduce((sum, s) => sum + s.endMs - s.startMs, 0) / 1000).toFixed(1)}s present</span></div>)}</div>
      <details><summary>Exact intervals</summary>{window.members.map((p, i) => <div key={`${p.account}-${i}`}><strong>{p.name || p.account}</strong><ul>{p.spans.map((s, j) => <li key={j}>{(s.startMs / 1000).toFixed(3)}–{(s.endMs / 1000).toFixed(3)}s: {s.state}</li>)}</ul></div>)}</details>
    </section>
    <div className="readiness-members">{selected.members.map((p, i) => <div key={`${p.account}-${i}`} data-focused={focusedAccount === p.account}><img src={classIconSrc(p.profession)} alt=""/><span>{onPlayer ? <button type="button" aria-pressed={focusedAccount === p.account} onClick={() => onPlayer(p.account)} title="Focus player combat timeline"><strong>{p.name || p.account}</strong><small>{p.account}</small></button> : <><strong>{p.name || p.account}</strong><small>{p.account}</small></>}</span><b data-state={p.state}>{p.state}{p.value !== null && p.value > 0 ? ` (${p.value})` : ''}</b></div>)}</div>
    </details>
    </div>
  </section>;
}
