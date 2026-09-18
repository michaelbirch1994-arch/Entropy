import { describe, expect, it } from 'vitest';
import type { WvWReport } from '../../types/report';
import {
  CURRENT_WVW_REFERENCE_CATALOG,
  RESPONSE_RULES,
  referenceCatalogStamp,
  resolveWvWReferenceCatalog,
  responseReferenceForReport,
} from '../insight/referenceCatalog';

const reportWithCatalog = (id?: string) => ({
  meta: id === undefined ? {} : { referenceCatalog: { id } },
}) as unknown as WvWReport;

describe('WvW reference catalog', () => {
  it('keeps reviewed skills uniquely identified and traceable', () => {
    const catalog = CURRENT_WVW_REFERENCE_CATALOG;
    expect(catalog.skills).toHaveLength(8);
    expect(new Set(catalog.skills.map((skill) => skill.skillId)).size).toBe(catalog.skills.length);
    expect(new Set(catalog.skills.map((skill) => skill.name)).size).toBe(catalog.skills.length);
    expect(Object.values(catalog.sources).every((source) => source.startsWith('https://'))).toBe(true);
    expect(catalog.skills.every((skill) => skill.source.startsWith('https://'))).toBe(true);
    expect(RESPONSE_RULES.map((rule) => rule.skillId)).toEqual(catalog.skills.map((skill) => skill.skillId));
  });

  it('keeps WvW overrides separate from ArenaNet baseline facts', () => {
    const purgingFlames = CURRENT_WVW_REFERENCE_CATALOG.skills.find((skill) => skill.skillId === 9187);
    const mantra = CURRENT_WVW_REFERENCE_CATALOG.skills.find((skill) => skill.skillId === 43357);
    expect(purgingFlames?.api.rechargeSeconds).toBe(20);
    expect(purgingFlames?.wvw.rechargeMs).toBe(28_000);
    expect(mantra?.api.rechargeSeconds).toBe(40);
    expect(mantra?.wvw.rechargeMs).toBe(60_000);
    expect(mantra?.wvw.cooldownModelMs).toBeNull();
  });

  it('resolves current, legacy, and unavailable catalog states explicitly', () => {
    expect(resolveWvWReferenceCatalog(CURRENT_WVW_REFERENCE_CATALOG.id)).toBe(CURRENT_WVW_REFERENCE_CATALOG);
    expect(responseReferenceForReport(reportWithCatalog()).status).toBe('legacy-current-fallback');
    expect(responseReferenceForReport(reportWithCatalog(CURRENT_WVW_REFERENCE_CATALOG.id)).status).toBe('pinned');
    const unavailable = responseReferenceForReport(reportWithCatalog('missing-reference-version'));
    expect(unavailable.status).toBe('pinned-catalog-unavailable');
    expect(unavailable.rules).toEqual([]);
  });

  it('records sorted, deduplicated source versions on new reports', () => {
    expect(referenceCatalogStamp([
      { gW2Build: 200, eliteInsightsVersion: '3.2', arcVersion: 'EVTC-B' },
      { gW2Build: 100, eliteInsightsVersion: '3.1', arcVersion: 'EVTC-A' },
      { gW2Build: 200, eliteInsightsVersion: '3.2', arcVersion: 'EVTC-B' },
      {},
    ])).toMatchObject({
      id: CURRENT_WVW_REFERENCE_CATALOG.id,
      sourceGameBuilds: [100, 200],
      eliteInsightsVersions: ['3.1', '3.2'],
      arcVersions: ['EVTC-A', 'EVTC-B'],
    });
  });
});
