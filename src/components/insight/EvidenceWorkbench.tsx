import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, BrainCircuit, Link2, Search, X } from 'lucide-react';
import type { InsightEvidence } from '../../lib/insight/evidence';
import InsightEvidenceDetails from './InsightEvidenceDetails';
import EvidenceProvenance from './EvidenceProvenance';
import SkillReferences from './SkillReferences';
import './EvidenceWorkbench.css';

type Finding = { title: string; explanation: string; confidence: string; evidenceIds: string[] };
type Props = {
  evidence: InsightEvidence[];
  findings: Finding[];
  selected: InsightEvidence | null;
  onSelect: (record: InsightEvidence | null) => void;
  onReplay: (record: InsightEvidence) => void;
  onFollowUp: (record: InsightEvidence) => void;
};

export default function EvidenceWorkbench({ evidence, findings, selected, onSelect, onReplay, onFollowUp }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const cited = useMemo(() => new Set(findings.flatMap(f => f.evidenceIds)), [findings]);
  const visible = evidence.filter(record => {
    const linked = findings.filter(f => f.evidenceIds.includes(record.id));
    return (filter !== 'cited' || cited.has(record.id)) && (filter !== 'replay' || record.replay)
      && `${record.id} ${record.label} ${linked.map(f => f.title).join(' ')}`.toLowerCase().includes(query.toLowerCase());
  });
  const position = selected ? evidence.findIndex(e => e.id === selected.id) : -1;
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
    if (!selected && dialog.current?.open) dialog.current.close();
    if (selected) { title.current?.focus(); dialog.current?.scrollTo(0, 0); }
  }, [selected]);
  return <section className="insight-workbench" aria-label="Evidence workbench">
    <header><div><span className="insight-eyebrow"><Link2 size={15}/> EVIDENCE CONNECTIONS</span><h2>Behind the findings</h2></div><span>{cited.size} cited / {evidence.length} records</span></header>
    <div className="insight-workbench-controls"><label className="insight-search"><Search size={16}/><input aria-label="Search evidence" placeholder="Find evidence or a linked finding" value={query} onChange={e => setQuery(e.target.value)}/></label><div role="group" aria-label="Evidence filter">{[['all', 'All records'], ['cited', 'Cited'], ['replay', 'Replay moments']].map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
    <div className="insight-evidence-index">{visible.map(record => {
      const related = findings.filter(f => f.evidenceIds.includes(record.id));
      return <button type="button" key={record.id} className="insight-evidence-source" onClick={() => onSelect(record)}><span className="insight-source-id">{record.id}</span><div><strong>{record.label}</strong><small>{record.replay ? 'Replay available' : 'Report evidence'}{related.length ? ` / ${related.length} linked ${related.length === 1 ? 'finding' : 'findings'}` : ''}</small>{related.map(f => <span className="insight-source-finding" key={f.title}><Link2 size={12}/>{f.title}</span>)}</div><ArrowUpRight size={16}/></button>;
    })}</div>
    {!visible.length && <p className="insight-record-note">No evidence matches this filter.</p>}
    <dialog ref={dialog} className="insight-evidence-dialog" aria-labelledby="insight-inspector-title" onCancel={event => { event.preventDefault(); onSelect(null); }} onClose={() => { if (selected) onSelect(null); }}>
      {selected && <><header className="insight-inspector-heading"><div><span className="insight-eyebrow"><BookOpen size={14}/>{selected.id} / EVIDENCE</span><h2 id="insight-inspector-title" ref={title} tabIndex={-1}>{selected.label}</h2></div><button type="button" aria-label="Close evidence" title="Close evidence" onClick={() => onSelect(null)}><X size={20}/></button></header>
        <div className="insight-inspector-actions"><div><button type="button" aria-label="Previous evidence" title="Previous evidence" disabled={position <= 0} onClick={() => onSelect(evidence[position - 1])}><ArrowLeft size={16}/></button><span>{position + 1} / {evidence.length}</span><button type="button" aria-label="Next evidence" title="Next evidence" disabled={position >= evidence.length - 1} onClick={() => onSelect(evidence[position + 1])}><ArrowRight size={16}/></button></div><div>{selected.replay && <button type="button" onClick={() => onReplay(selected)}>Replay<ArrowUpRight size={15}/></button>}<button type="button" onClick={() => onFollowUp(selected)}><BrainCircuit size={16}/>Investigate further</button></div></div>
        {!!findings.filter(f => f.evidenceIds.includes(selected.id)).length && <section className="insight-linked-findings"><h3>Referenced by</h3>{findings.filter(f => f.evidenceIds.includes(selected.id)).map((finding, index) => <details key={index}><summary>{finding.title}<span>{finding.confidence}</span></summary><p>{finding.explanation}</p></details>)}</section>}
        {selected.provenance && <EvidenceProvenance items={selected.provenance} title="Evidence record provenance"/>}
        <InsightEvidenceDetails data={selected.data}/>
        <SkillReferences key={selected.id} data={selected.data}/>
      </>}
    </dialog>
  </section>;
}
