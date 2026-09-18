import { useMemo, useRef, useState } from 'react';
import { Activity, Upload, Trash2, ChevronLeft, ChevronRight, Link2 } from 'lucide-react';
import { captureSignals, parseRawCapture } from '../lib/insight/rawCapture';
import { matchRawEncounter } from '../lib/insight/rawEncounter';
import RawCombatStory from '../components/insight/RawCombatStory';
import { setRawCapture, useRawCapture } from '../store/RawCaptureStore';
import { useReport } from '../store/ReportContext';
import '../Styles/RawWorkspace.css';

export default function RawView() {
  const { report } = useReport(); const raw = useRawCapture(); const input = useRef<HTMLInputElement>(null);
  const encounterInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [query, setQuery] = useState(''); const [stream, setStream] = useState('all'); const [page, setPage] = useState(0);
  const capture = raw.capture;
  const rows = useMemo(() => capture?.events.filter(e => (stream === 'all' || e.stream === stream) && `${e.kind} ${e.skillId ?? ''} ${e.sourceId ?? ''} ${e.details['Destination field'] ?? ''}`.toLowerCase().includes(query.toLowerCase())) ?? [], [capture, stream, query]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / 100) - 1));
  const eligible = Boolean(report && capture?.accounts.some(a => report.stats.offensePlayers?.some(p => p.account === a)));
  async function load(file?: File) {
    if (!file) return; setBusy(true); setError('');
    try { if (file.size > 150000000) throw new Error('Capture exceeds the 150 MB limit.'); const parsed = parseRawCapture(await file.text(), file.name); setRawCapture(parsed); setPage(0); }
    catch (e) { setError(e instanceof Error ? e.message : 'Capture could not be read.'); } finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  async function checkEncounter(file?: File) {
    if (!file || !capture || busy) return;
    setBusy(true); setError('');
    try {
      if (file.size > 150000000) throw new Error('EVTC exceeds the 150 MB limit.');
      const { readEncounterFile } = await import('../lib/insight/readEncounterFile');
      const match = matchRawEncounter(capture, await readEncounterFile(file), file.name);
      const matches = capture.encounterMatches.filter(m => m.name !== match.name);
      if (matches.length >= 20) throw new Error('A maximum of 20 encounter checks can be attached.');
      setRawCapture({ ...capture, encounterMatches: [...matches, match] }, raw.report);
    } catch (e) { setError(e instanceof Error ? e.message : 'Encounter check failed.'); }
    finally { setBusy(false); if (encounterInput.current) encounterInput.current.value = ''; }
  }
  return <main className="raw-workspace">
    <header><div><span className="raw-eyebrow"><Activity size={16}/> ENTROPY / CAPTURE EVIDENCE</span><h1>Raw</h1><p>{capture?.name ?? 'Companion recordings'}</p></div><div className="raw-actions"><input ref={input} type="file" accept=".jsonl" hidden onChange={e => void load(e.target.files?.[0])}/><button disabled={busy} onClick={() => input.current?.click()}><Upload size={16}/>{busy ? 'Reading capture…' : 'Import capture'}</button>{capture && <button title="Remove capture" aria-label="Remove capture" onClick={() => setRawCapture(null)}><Trash2 size={16}/></button>}</div></header>
    {error && <p role="alert" className="raw-error">{error}</p>}
    {!capture ? <section className="raw-empty"><Activity size={48}/><h2>No recording loaded</h2><p>ArcDPS companion · JSONL</p></section> : <>
      {capture.warnings.map(warning => <p className="raw-error" key={warning}>{warning}</p>)}
      {capture.segment && <section className="raw-association" aria-label="Capture segment"><div><strong>Segment {capture.segment.index}</strong><p>{capture.segment.sessionId}</p></div><span>{capture.segment.continued === true ? 'Next segment expected' : capture.segment.continued === false ? 'Final segment reported' : 'Continuation unknown'}</span></section>}
      <section className="raw-retention" aria-label="Recording retention"><div><strong>{capture.retention?.savedPercent == null ? 'Unknown retention' : `${capture.retention.savedPercent.toFixed(2)}% saved`}</strong><span>{capture.retention ? `${capture.written.toLocaleString()} of ${capture.retention.attempted.toLocaleString()} attempted callbacks` : 'Shutdown accounting unavailable'}</span></div><progress aria-label="Callbacks retained" max={100} value={capture.retention?.savedPercent ?? undefined}/><p>Callback retention, not fight coverage or AI confidence. {capture.retention?.sizeLimited ? 'File limit reached; later events were not retained.' : 'Unrecorded actions remain unknown.'}</p></section>
      <section className="raw-signals" aria-label="Area stream observations">{captureSignals(capture).map(signal => <button key={signal.label} onClick={() => { setStream('area'); setQuery(signal.filter); setPage(0); }}><Activity size={16}/><span>{signal.label}<strong>{signal.count.toLocaleString()}</strong></span></button>)}</section>
      <section className="raw-totals" aria-label="Capture integrity">{[['Callbacks', capture.written.toLocaleString()], ['Queue drops', capture.dropped === null ? 'Unknown' : capture.dropped.toLocaleString()], ['Shutdown', capture.finalized ? 'Recorded' : 'Unconfirmed'], ['Collector', capture.version]].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</section>
      <section className="raw-association"><div><strong>{raw.report === report && report ? 'Attached to current report' : 'Session evidence · not fight-aligned'}</strong><p>Recording account: {capture.accounts.join(', ') || 'Unresolved'}. Counts include all actors and fights in this capture.</p></div><button disabled={!eligible} onClick={() => setRawCapture(capture, raw.report === report ? null : report)}><Link2 size={16}/>{raw.report === report && report ? 'Detach from Insight' : 'Attach summary to Insight'}</button></section>
      <section className="raw-encounters" aria-label="Encounter start checks"><div className="raw-actions"><h2>Encounter start checks</h2><input ref={encounterInput} hidden type="file" accept=".evtc,.zevtc" onChange={e => void checkEncounter(e.target.files?.[0])}/><button disabled={busy} onClick={() => encounterInput.current?.click()}><Link2 size={16}/>Check combat log</button></div><p className="raw-note">.evtc or .zevtc · Exact start bytes and recorder identity. Not an automatic match to the active report.</p>{capture.encounterMatches.map(m => <div className="raw-encounter" key={m.name}><strong>{m.name}</strong><span>{m.status === 'start-matched' ? 'Start matched' : 'No verified start match'}</span><small>{m.recorder ?? 'Recorder unresolved'} · {m.exactEnd ? 'Exact end bytes matched' : 'End alignment unverified'}</small></div>)}</section>
      <RawCombatStory key={capture.name} capture={capture}/>
      <details><summary>Event inventory · {Object.keys(capture.counts).length} categories</summary><div className="raw-inventory">{Object.entries(capture.counts).map(([label, count]) => <div key={label}><span>{label}</span><strong>{count.toLocaleString()}</strong></div>)}</div></details>
      <div className="raw-filters"><input aria-label="Search raw events" placeholder="Search event, skill or actor ID" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }}/><select aria-label="Event stream" value={stream} onChange={e => { setStream(e.target.value); setPage(0); }}><option value="all">Both streams</option><option value="area">Area</option><option value="local">Local</option></select><span>{rows.length.toLocaleString()} events</span></div>
      <p className="raw-note">Raw ticks are not fight-relative times. Uninterpreted records retain unknown timing. Local and area observations may overlap.</p>
      <div className="raw-table"><table><thead><tr>{['Sequence', 'Stream', 'Event', 'Raw tick (ms)', 'Skill ID', 'Source field', 'Recorded details'].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{rows.slice(currentPage * 100, currentPage * 100 + 100).map(e => <tr key={e.sequence}><td>{e.sequence}</td><td>{e.stream}</td><td>{e.kind}</td><td>{e.tick ?? '—'}</td><td>{e.skillId || '—'}</td><td>{e.sourceId ?? '—'}</td><td>{Object.keys(e.details).length ? <details className="raw-event-details"><summary aria-label={`Recorded details for event ${e.sequence}`}>Inspect</summary><dl>{Object.entries(e.details).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>Raw fields only. No verified player mapping, cooldown or outcome.</p></details> : 'Not decoded'}</td></tr>)}</tbody></table>{!rows.length && <p>No matching events.</p>}</div>
      <footer><button aria-label="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16}/></button><span>{currentPage + 1} / {Math.max(1, Math.ceil(rows.length / 100))}</span><button aria-label="Next page" disabled={(currentPage + 1) * 100 >= rows.length} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16}/></button></footer>
    </>}
  </main>;
}
