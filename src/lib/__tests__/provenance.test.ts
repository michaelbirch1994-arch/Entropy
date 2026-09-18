import { describe, expect, it } from 'vitest';
import { normalizeEvidenceProvenance, provenanceTier, summarizeEvidenceProvenance } from '../insight/provenance';

describe('Insight evidence provenance', () => {
  const observed = { id: 'casts', kind: 'recorded-event' as const, label: 'Skill casts', detail: 'Timestamped cast starts.' };

  it('keeps observations, parser derivations, references, and inferences distinct', () => {
    expect(provenanceTier('recorded-event')).toBe('observed');
    expect(provenanceTier('parser-derived-state')).toBe('derived');
    expect(provenanceTier('arena-net-api')).toBe('reference');
    expect(provenanceTier('wvw-override')).toBe('reference');
    expect(provenanceTier('bounded-inference')).toBe('inferred');
    expect(provenanceTier('user-assumption')).toBe('inferred');
  });

  it('deduplicates stable evidence identities and reports the evidence mix', () => {
    const items = normalizeEvidenceProvenance([
      observed,
      observed,
      { id: 'states', kind: 'parser-derived-state', label: 'Effect states', detail: 'Parser transitions.' },
      { id: 'api', kind: 'arena-net-api', label: 'Skill facts', detail: 'Structured facts.' },
      { id: 'join', kind: 'bounded-inference', label: 'Timing join', detail: 'Temporal association.' },
      null,
    ]);
    expect(items).toHaveLength(4);
    expect(summarizeEvidenceProvenance(items)).toEqual({
      tiers: { observed: 1, derived: 1, reference: 1, inferred: 1 }, total: 4, hasInference: true,
    });
  });
});
