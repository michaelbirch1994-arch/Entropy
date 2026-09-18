import { Activity } from 'lucide-react';
import { classIconSrc } from '../../data/classIconAssets';
import { reportImageSrc } from '../../utils/reportImageAssets';

type ReadinessResult = {
  name: string; total: number; present: number; absent: number; unknown: number;
  observedCoverage: number | null; evidenceCoverage: number | null; bounds: [number, number] | null;
};
type BoundaryResult = {
  name: string; observedCoverageRange: [number, number] | null;
  fullSquadBoundsEnvelope: [number, number] | null; boundarySensitive: boolean;
};

const labels: Record<string, string> = {
  group: 'Subgroup', combatTimeMs: 'Time in combat', squadTimeMs: 'Time in squad',
  totalFightMs: 'Fight participation', activeMs: 'Active time', timeMs: 'Time played',
  deathTimeMs: 'Death at', downTimeMs: 'Down at', classTimes: 'Professions played',
  strongestToDown: 'Largest hits before down', strongestToKill: 'Largest hits before death',
  toDownTotal: 'Damage before down', toKillTotal: 'Damage before death',
  condiCleanse: 'Conditions cleansed', stunBreak: 'Stun breaks', src: 'Source',
};
function fieldLabel(key: string) {
  return labels[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/ Ms$/, '').replace(/^./, c => c.toUpperCase());
}
function display(value: unknown, key = ''): string {
  if (value == null) return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'Not recorded';
    if (key.endsWith('Ms')) {
      const seconds = Math.round(value / 1000);
      return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}
function EvidenceImage({ src }: { src?: string }) {
  return <span className="insight-record-icon"><Activity size={20}/>{src && <img src={reportImageSrc(src)} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }}/>}</span>;
}

const pct = (value: number | null | undefined) => value == null ? 'Unknown' : `${Math.round(value * 100)}%`;
const timestamp = (value: number) => `${Math.floor(value / 60000)}:${String(Math.floor(value / 1000) % 60).padStart(2, '0')}.${String(Math.floor(value % 1000)).padStart(3, '0')}`;
const pair = (value: [number, number] | null | undefined) => value ? `${pct(value[0])}–${pct(value[1])}` : 'Unknown';

function readinessPayload(data: unknown) {
  if (!data || typeof data !== 'object') return null;
  const root = data as Record<string, unknown>;
  const selected = root.selectedEvidence && typeof root.selectedEvidence === 'object'
    ? root.selectedEvidence as Record<string, unknown> : root;
  if (selected.methodVersion !== 'readiness-v3' || !Array.isArray(selected.results)) return null;
  return { selected, context: root.executionContext && typeof root.executionContext === 'object' ? root.executionContext as Record<string, unknown> : null };
}

function SquadReadinessEvidence({ data }: { data: unknown }) {
  const payload = readinessPayload(data)!;
  const selected = payload.selected;
  const anchor = selected.analysisAnchor && typeof selected.analysisAnchor === 'object' ? selected.analysisAnchor as Record<string, unknown> : null;
  const results = selected.results as ReadinessResult[];
  const boundary = selected.boundarySensitivity && typeof selected.boundarySensitivity === 'object'
    ? selected.boundarySensitivity as { boundsMs?: [number, number]; results?: BoundaryResult[] } : null;
  const continuity = selected.continuity && typeof selected.continuity === 'object' ? selected.continuity as Record<string, any> : null;
  const limitations = Array.isArray(selected.limitations) ? selected.limitations.map(String) : [];
  const timeMs = typeof selected.timeMs === 'number' ? selected.timeMs : 0;
  return <div className="readiness-evidence-summary">
    <section className="readiness-evidence-anchor"><div><span>ANALYSIS ANCHOR</span><h3>{String(anchor?.label ?? 'Manual moment')}</h3><p>{String(selected.selection ?? 'Selection method not recorded')}</p></div><dl><div><dt>Selected</dt><dd>{timestamp(timeMs)}</dd></div><div><dt>Evidence status</dt><dd>{String(anchor?.evidenceStatus ?? 'Unknown')}</dd></div><div><dt>Target scope</dt><dd>{anchor?.scope === 'recorded-enemy-players' ? 'Recorded enemy players' : anchor?.scope === 'all-targets' ? 'All recorded targets' : 'Manual'}</dd></div><div><dt>Source resolution</dt><dd>{typeof anchor?.resolutionMs === 'number' ? `${anchor.resolutionMs / 1000}s` : 'Not measured'}</dd></div></dl></section>
    <section className="readiness-evidence-measures" aria-label="Squad boon-state measurements">{results.map(result => <article key={result.name} data-boon={result.name}><header><strong>{result.name}</strong><b>{pct(result.observedCoverage)}</b></header><dl><div><dt>Measurement</dt><dd>{result.present}/{result.present + result.absent} known present</dd></div><div><dt>Evidence coverage</dt><dd>{pct(result.evidenceCoverage)}</dd></div><div><dt>Possible squad range</dt><dd>{pair(result.bounds)}</dd></div><div><dt>Unknown players</dt><dd>{result.unknown}/{result.total}</dd></div></dl></article>)}</section>
    {boundary?.results?.length ? <section className="readiness-evidence-boundary"><header><div><span>BOUNDARY CHECK</span><h3>{boundary.results.some(result => result.boundarySensitive) ? 'The source bin can change the result.' : 'The measured counts hold across the source bin.'}</h3></div>{boundary.boundsMs && <strong>{timestamp(boundary.boundsMs[0])}–{timestamp(boundary.boundsMs[1])}</strong>}</header><div>{boundary.results.map(result => <div key={result.name} data-sensitive={result.boundarySensitive}><strong>{result.name}</strong><span>{pair(result.observedCoverageRange)}</span><small>{result.boundarySensitive ? 'Changes inside bin' : 'Stable inside bin'}</small></div>)}</div></section> : null}
    {continuity && <section className="readiness-evidence-continuity"><header><span>CONTINUITY</span><h3>{String(continuity.boon ?? 'Selected boon')} around the anchor</h3></header><div>{(['before', 'after'] as const).map(period => { const value = continuity[period] as Record<string, any> | undefined; return <dl key={period}><div><dt>{period}</dt><dd>{value ? `${(Number(value.startMs) / 1000).toFixed(1)}–${(Number(value.endMs) / 1000).toFixed(1)}s` : 'Unknown'}</dd></div><div><dt>Known player-time present</dt><dd>{pct(value?.observedCoverage)}</dd></div><div><dt>Evidence coverage</dt><dd>{pct(value?.evidenceCoverage)}</dd></div><div><dt>Possible range</dt><dd>{pair(value?.bounds)}</dd></div></dl>; })}</div></section>}
    <section className="readiness-evidence-limits"><h3>Interpretation limits</h3><ul>{limitations.map(limit => <li key={limit}>{limit}</li>)}</ul></section>
  </div>;
}

function RawDetails({ data }: { data: unknown }) {
  if (data === null || data === undefined) return <span>Not recorded</span>;
  if (typeof data !== 'object') return <span>{typeof data === 'boolean' ? (data ? 'Yes' : 'No') : String(data)}</span>;
  const entries = Object.entries(data);
  if (!entries.length) return <span>No entries recorded</span>;
  return <dl className="insight-evidence-fields">{entries.map(([key, value]) => {
    const label = Array.isArray(data) ? `Entry ${Number(key) + 1}` : fieldLabel(key);
    return <div key={key}>{value !== null && typeof value === 'object' ? <details><summary>{label}</summary><RawDetails data={value}/></details> : <><dt>{label}</dt><dd><RawDetails data={value}/></dd></>}</div>;
  })}</dl>;
}

function RecordView({ data, name = '' }: { data: unknown; name?: string }) {
  if (data == null || typeof data !== 'object') return <span>{display(data, name)}</span>;
  if (Array.isArray(data)) {
    if (!data.length) return <p className="insight-record-note">No entries recorded.</p>;
    if (data.every(item => item == null || typeof item !== 'object')) return <ul className="insight-record-values">{data.map((item, index) => <li key={index}>{display(item)}</li>)}</ul>;
    return <div className="insight-record-list">{data.map((item, index) => <RecordView key={index} data={item}/>)}</div>;
  }
  const row = data as Record<string, unknown>;
  const title = row.name ?? row.characterName ?? row.account ?? row.profession ?? row.label;
  const icon = typeof row.icon === 'string' ? row.icon : classIconSrc(typeof row.profession === 'string' ? row.profession : '');
  const entries = Object.entries(row).filter(([key]) => !['icon', 'name', 'characterName', 'account', 'profession', 'label'].includes(key));
  const simple = entries.filter(([, value]) => value == null || typeof value !== 'object');
  const nested = entries.filter(([, value]) => value !== null && typeof value === 'object');
  const percent = row.unit === 'percent' && typeof row.value === 'number' ? row.value : undefined;
  return <div className="insight-record">
    {title != null && <div className="insight-record-title"><EvidenceImage src={icon}/><div><strong>{String(title)}</strong>{row.profession != null && title !== row.profession && <small>{String(row.profession)}</small>}</div></div>}
    {simple.length > 0 && <dl className="insight-record-stats">{simple.filter(([key]) => !(key === 'unit' && row.value != null)).map(([key, value]) => <div key={key}><dt>{fieldLabel(key)}</dt><dd>{display(value, key)}{key === 'value' && value != null && row.unit != null ? (row.unit === 'percent' ? '%' : ` ${row.unit}`) : ''}</dd></div>)}</dl>}
    {percent !== undefined && <div className="insight-record-meter" role="img" aria-label={`${row.name}: ${display(percent)} percent`}><span style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}/></div>}
    {nested.map(([key, value]) => <section className="insight-record-section" key={key}><h4>{fieldLabel(key)}</h4><RecordView data={value} name={key}/></section>)}
  </div>;
}

export default function InsightEvidenceDetails({ data }: { data: unknown }) {
  const readiness = readinessPayload(data);
  return <div className="insight-evidence-readable">{readiness ? <SquadReadinessEvidence data={data}/> : <RecordView data={data}/>}<details className="insight-record-technical"><summary>Full evidence record</summary><RawDetails data={data}/></details></div>;
}
