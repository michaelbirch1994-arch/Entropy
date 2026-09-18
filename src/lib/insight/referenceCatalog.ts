import catalogData from '../../data/wvwReferenceCatalog.json';
import type { ReportReferenceCatalog, WvWReport } from '../../types/report';

export type ResponseKind = 'revive' | 'stunbreak' | 'cleanse' | 'unknown';

export interface WvWReferenceSkill {
  skillId: number;
  name: string;
  api: {
    name: string;
    rechargeSeconds: number;
    range?: number;
    distanceFacts?: Record<string, number>;
    buffStatuses: string[];
    stunBreak?: boolean;
    flipSkillId?: number;
  };
  wvw: {
    rechargeMs: number;
    cooldownModelMs: number | null;
    maxReach: number | null;
  };
  response: {
    kind: Exclude<ResponseKind, 'unknown'>;
    summary: string;
    aliases?: string[];
    assumedProfession?: string;
    preventionOnly?: boolean;
  };
  source: string;
}

export interface WvWReferenceCatalog {
  id: string;
  mode: 'WvW';
  reviewedAt: string;
  sources: {
    arenaNetApi: string;
    guildWars2WikiApi: string;
    arcDpsEvtc: string;
    eliteInsights: string;
  };
  skills: WvWReferenceSkill[];
}

export interface ResponseRule {
  name: string;
  kind: Exclude<ResponseKind, 'unknown'>;
  cooldownMs: number | null;
  maxReach: number | null;
  response: string;
  source: string;
  assumedProfession?: string;
  skillId: number;
  aliases?: string[];
  preventionOnly?: boolean;
}

export const CURRENT_WVW_REFERENCE_CATALOG = catalogData as WvWReferenceCatalog;

const catalogs = new Map<string, WvWReferenceCatalog>([
  [CURRENT_WVW_REFERENCE_CATALOG.id, CURRENT_WVW_REFERENCE_CATALOG],
]);

export const RESPONSE_RULES: ResponseRule[] = CURRENT_WVW_REFERENCE_CATALOG.skills.map((skill) => ({
  name: skill.name,
  kind: skill.response.kind,
  cooldownMs: skill.wvw.cooldownModelMs,
  maxReach: skill.wvw.maxReach,
  response: skill.response.summary,
  source: skill.source,
  assumedProfession: skill.response.assumedProfession,
  skillId: skill.skillId,
  aliases: skill.response.aliases,
  preventionOnly: skill.response.preventionOnly,
}));

export function resolveWvWReferenceCatalog(id?: string | null) {
  return id ? catalogs.get(id) ?? null : CURRENT_WVW_REFERENCE_CATALOG;
}

export function responseReferenceForReport(report: Pick<WvWReport, 'meta'>) {
  // Archived reports can predate the reference stamp even though current reports require meta.
  const requestedId = report.meta?.referenceCatalog?.id;
  const catalog = resolveWvWReferenceCatalog(requestedId);
  if (!catalog) return { catalog: null, rules: [] as ResponseRule[], status: 'pinned-catalog-unavailable' as const };
  return {
    catalog,
    rules: catalog === CURRENT_WVW_REFERENCE_CATALOG ? RESPONSE_RULES : catalog.skills.map((skill) => ({
      name: skill.name,
      kind: skill.response.kind,
      cooldownMs: skill.wvw.cooldownModelMs,
      maxReach: skill.wvw.maxReach,
      response: skill.response.summary,
      source: skill.source,
      assumedProfession: skill.response.assumedProfession,
      skillId: skill.skillId,
      aliases: skill.response.aliases,
      preventionOnly: skill.response.preventionOnly,
    })),
    status: requestedId ? 'pinned' as const : 'legacy-current-fallback' as const,
  };
}

const uniqueNumbers = (values: Array<number | undefined>) => [...new Set(values.filter((value): value is number => value !== undefined && Number.isInteger(value) && value > 0))].sort((a, b) => a - b);
const uniqueStrings = (values: Array<string | undefined>) => [...new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))].sort();

export function referenceCatalogStamp(sources: Array<{ gW2Build?: number; eliteInsightsVersion?: string; arcVersion?: string }>): ReportReferenceCatalog {
  return {
    id: CURRENT_WVW_REFERENCE_CATALOG.id,
    mode: CURRENT_WVW_REFERENCE_CATALOG.mode,
    reviewedAt: CURRENT_WVW_REFERENCE_CATALOG.reviewedAt,
    sourceGameBuilds: uniqueNumbers(sources.map((source) => source.gW2Build)),
    eliteInsightsVersions: uniqueStrings(sources.map((source) => source.eliteInsightsVersion)),
    arcVersions: uniqueStrings(sources.map((source) => source.arcVersion)),
  };
}
