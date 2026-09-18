export type EvidenceProvenanceKind =
  | 'recorded-event'
  | 'parser-derived-state'
  | 'arena-net-api'
  | 'wvw-override'
  | 'bounded-inference'
  | 'user-assumption';

export type EvidenceProvenanceTier = 'observed' | 'derived' | 'reference' | 'inferred';

export interface EvidenceProvenance {
  id: string;
  kind: EvidenceProvenanceKind;
  label: string;
  detail: string;
  source?: string;
}

export const provenanceTier = (kind: EvidenceProvenanceKind): EvidenceProvenanceTier => {
  if (kind === 'recorded-event') return 'observed';
  if (kind === 'parser-derived-state') return 'derived';
  if (kind === 'arena-net-api' || kind === 'wvw-override') return 'reference';
  return 'inferred';
};

export function normalizeEvidenceProvenance(items: Array<EvidenceProvenance | null | undefined | false>) {
  const unique = new Map<string, EvidenceProvenance>();
  for (const item of items) {
    if (!item || !item.id.trim() || !item.label.trim() || !item.detail.trim()) continue;
    const key = `${item.kind}\u0000${item.id}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()];
}

export function summarizeEvidenceProvenance(items: EvidenceProvenance[]) {
  const tiers: Record<EvidenceProvenanceTier, number> = { observed: 0, derived: 0, reference: 0, inferred: 0 };
  for (const item of normalizeEvidenceProvenance(items)) tiers[provenanceTier(item.kind)]++;
  return { tiers, total: Object.values(tiers).reduce((sum, count) => sum + count, 0), hasInference: tiers.inferred > 0 };
}
