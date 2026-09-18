import { BookOpenCheck, Calculator, Database, Fingerprint, Radio, UserRoundCog } from 'lucide-react';
import {
  normalizeEvidenceProvenance,
  provenanceTier,
  summarizeEvidenceProvenance,
  type EvidenceProvenance as EvidenceProvenanceRecord,
  type EvidenceProvenanceKind,
} from '../../lib/insight/provenance';
import './EvidenceProvenance.css';

const icons: Record<EvidenceProvenanceKind, typeof Radio> = {
  'recorded-event': Radio,
  'parser-derived-state': Database,
  'arena-net-api': BookOpenCheck,
  'wvw-override': BookOpenCheck,
  'bounded-inference': Calculator,
  'user-assumption': UserRoundCog,
};

const tierLabel = { observed: 'Observed', derived: 'Derived', reference: 'Reference', inferred: 'Inferred' } as const;

export default function EvidenceProvenance({ items, compact = false, title = 'Evidence chain' }: {
  items: EvidenceProvenanceRecord[];
  compact?: boolean;
  title?: string;
}) {
  const normalized = normalizeEvidenceProvenance(items);
  if (!normalized.length) return null;
  const summary = summarizeEvidenceProvenance(normalized);
  return <section className="evidence-provenance" data-compact={compact} aria-label={title}>
    <header><span><Fingerprint size={14}/>{title}</span><small>{summary.tiers.observed} observed · {summary.tiers.derived} derived · {summary.tiers.reference} reference · {summary.tiers.inferred} inferred</small></header>
    <div>{normalized.map(item => {
      const Icon = icons[item.kind];
      const tier = provenanceTier(item.kind);
      const content = <><Icon size={14}/><span><small>{tierLabel[tier]}</small><strong>{item.label}</strong><em>{item.detail}</em></span></>;
      return item.source
        ? <a key={`${item.kind}:${item.id}`} data-tier={tier} href={item.source} target="_blank" rel="noreferrer">{content}</a>
        : <div key={`${item.kind}:${item.id}`} data-tier={tier}>{content}</div>;
    })}</div>
  </section>;
}
