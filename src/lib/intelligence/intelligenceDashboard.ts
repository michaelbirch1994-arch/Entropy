import type { DeathRecapEntry, DeathRecapHit, WvWReport } from "../../types/report";
import { createEngagementSegment, type EngagementSegment } from "./engagementTypes";
import { synthesizeFindings } from "./findingEngine";
import type { CriticalEvent, FindingCategory, FindingSeverity, IntelligenceFinding, PatternConfidence } from "./types";

export type IntelligenceReadiness = "stable" | "review" | "high-risk";

export interface IntelligenceAction {
  id: string;
  title: string;
  detail: string;
  basedOn: string[];
  confidence: PatternConfidence;
}

export interface IntelligenceTimelineItem {
  id: string;
  label: string;
  timestampMs: number;
  severity: FindingSeverity;
  category: FindingCategory;
  detail: string;
  downs: number;
  deaths: number;
  criticalEvents: number;
}

export interface IntelligenceEngagementInsight {
  id: string;
  label: string;
  fightId: string;
  timestampMs: number;
  pressureScore: number;
  pressurePercent: number;
  pressureLabel: "quiet" | "watch" | "danger" | "critical";
  priority: number;
  state: EngagementSegment["state"];
  downs: number;
  deaths: number;
  criticalEvents: number;
  findings: IntelligenceFinding[];
  topFinding?: IntelligenceFinding;
  reviewPrompt: string;
  evidencePoints: string[];
}

export interface IntelligenceDashboard {
  persisted: boolean;
  readiness: IntelligenceReadiness;
  headline: string;
  summary: string;
  segments: EngagementSegment[];
  criticalEvents: CriticalEvent[];
  findings: IntelligenceFinding[];
  engagements: IntelligenceEngagementInsight[];
  timeline: IntelligenceTimelineItem[];
  actions: IntelligenceAction[];
  severityCounts: Record<FindingSeverity, number>;
  categoryCounts: Partial<Record<FindingCategory, number>>;
  totals: {
    downs: number;
    deaths: number;
    segments: number;
    criticalEvents: number;
    findings: number;
  };
  coverage: {
    replay: boolean;
    mechanics: boolean;
    deathRecaps: boolean;
    survivalSupport: boolean;
    fightRows: boolean;
  };
}

const SEVERITY_WEIGHT: Record<FindingSeverity, number> = {
  info: 1,
  notable: 2,
  significant: 3,
  critical: 4,
};

const PRESSURE_LABEL_WEIGHT: Record<IntelligenceEngagementInsight["pressureLabel"], number> = {
  quiet: 1,
  watch: 2,
  danger: 3,
  critical: 4,
};

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatClock(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "?:??";
  const totalSeconds = Math.floor(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}m`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return Math.round(value).toLocaleString();
}

function totalDamage(hits: DeathRecapHit[]): number {
  return hits.reduce((sum, hit) => sum + asNumber(hit.damage), 0);
}

function strongestHit(hits: DeathRecapHit[]): DeathRecapHit | undefined {
  return [...hits].sort((a, b) => asNumber(b.damage) - asNumber(a.damage))[0];
}

function hitLabel(hit: DeathRecapHit | undefined): string {
  if (!hit) return "unknown source";
  const source = hit.src ? ` from ${hit.src}` : "";
  return `${hit.name}${source} (${formatCompact(asNumber(hit.damage))})`;
}

function isUsableDeathRecap(recap: DeathRecapEntry): boolean {
  return Boolean(
    recap.account &&
      Number.isFinite(recap.deathTimeMs) &&
      Number.isFinite(recap.fightIndex) &&
      Array.isArray(recap.toDown) &&
      Array.isArray(recap.toKill),
  );
}

function fightIdForDeathRecap(report: WvWReport, recap: DeathRecapEntry): string {
  const fight = report.stats.fightBreakdown?.[recap.fightIndex];
  return String(fight?.id || `fight-${recap.fightIndex + 1}`);
}

function buildDeathRecapCriticalEvents(report: WvWReport): CriticalEvent[] {
  const recaps = report.stats.deathRecaps ?? [];
  if (recaps.length === 0) return [];

  return recaps.filter(isUsableDeathRecap).map((recap, index) => {
    const toDownDamage = totalDamage(recap.toDown);
    const toKillDamage = totalDamage(recap.toKill);
    const downHit = strongestHit(recap.toDown);
    const killHit = recap.toKill[recap.toKill.length - 1] ?? strongestHit(recap.toKill) ?? downHit;
    const pieces = [
      `${recap.account} died at ${formatClock(recap.deathTimeMs)}.`,
      recap.toDown.length > 0 ? `Downed by ${hitLabel(downHit)} across ${formatCompact(toDownDamage)} pre-down damage.` : "No separate downstate damage packet was recorded.",
      recap.toKill.length > 0 ? `Finished by ${hitLabel(killHit)} after ${formatCompact(toKillDamage)} additional damage.` : "No separate deadstate finish packet was recorded.",
    ];

    return {
      id: `death-recap:${recap.fightIndex}:${recap.account}:${recap.deathTimeMs}:${index}`,
      timestampMs: recap.deathTimeMs,
      fightId: fightIdForDeathRecap(report, recap),
      category: "defense",
      kind: "death-recap",
      summary: pieces.join(" "),
      relatedEvents: [
        ...recap.toDown.map((hit) => `death-recap:down:${hit.id}:${hit.time}`),
        ...recap.toKill.map((hit) => `death-recap:kill:${hit.id}:${hit.time}`),
      ],
      relatedPlayers: [recap.account],
      confidence: "high",
    } satisfies CriticalEvent;
  });
}

function buildFallbackSegments(report: WvWReport): EngagementSegment[] {
  const fights = report.stats.fightBreakdown ?? [];

  return fights.slice(0, 12).map((fight, index) => {
    const timestamp = asNumber(fight.timestamp) || index * 100000;
    const durationMs = 60000;

    return createEngagementSegment({
      id: `legacy-engagement:${fight.id || index}`,
      fightId: String(fight.id || `fight-${index + 1}`),
      index,
      start: {
        timestampMs: timestamp,
        reason: "manual-or-derived",
        evidence: [
          {
            statement: "Segment derived from persisted fightBreakdown row because raw Intelligence windows are not present.",
            metrics: {
              fightIndex: index + 1,
              squadCount: asNumber(fight.squadCount),
              enemyCount: asNumber(fight.enemyCount),
            },
          },
        ],
      },
      end: {
        timestampMs: timestamp + durationMs,
        reason: "manual-or-derived",
        evidence: [
          {
            statement: "Duration is a display placeholder for a legacy report without persisted engagement windows.",
            metrics: { durationMs },
          },
        ],
      },
      durationMs,
      state: asNumber(fight.alliesDead) > 0 ? "wipe" : "active",
      confidence: "low",
      criticalEventIds: [],
      combatEventIds: [],
      participantKeys: [],
      downs: asNumber(fight.alliesDown),
      deaths: asNumber(fight.alliesDead),
      evidence: [
        {
          statement: "Fight-level down/death totals are available; CriticalEvent ids are not persisted for this report.",
          metrics: {
            alliesDown: asNumber(fight.alliesDown),
            alliesDead: asNumber(fight.alliesDead),
            enemyDowns: asNumber(fight.enemyDowns),
            enemyDeaths: asNumber(fight.enemyDeaths),
          },
        },
      ],
      note: fight.fullLabel || fight.label,
    });
  });
}

function severityCounts(findings: IntelligenceFinding[]): Record<FindingSeverity, number> {
  return findings.reduce<Record<FindingSeverity, number>>(
    (counts, finding) => {
      counts[finding.severity] += 1;
      return counts;
    },
    { info: 0, notable: 0, significant: 0, critical: 0 },
  );
}

function categoryCounts(findings: IntelligenceFinding[]): Partial<Record<FindingCategory, number>> {
  return findings.reduce<Partial<Record<FindingCategory, number>>>((counts, finding) => {
    counts[finding.category] = (counts[finding.category] ?? 0) + 1;
    return counts;
  }, {});
}

function readinessFor(findings: IntelligenceFinding[], deaths: number): IntelligenceReadiness {
  if (findings.some((finding) => finding.severity === "critical") || deaths >= 8) return "high-risk";
  if (findings.some((finding) => finding.severity === "significant") || deaths > 0 || findings.length > 0) return "review";
  return "stable";
}

function headlineFor(readiness: IntelligenceReadiness, findings: IntelligenceFinding[], persisted: boolean): string {
  if (!persisted) return "Legacy report: rebuild raw logs for full Intelligence.";
  if (readiness === "high-risk") return "High-risk engagement patterns detected.";
  if (readiness === "review") return "Reviewable pressure patterns detected.";
  if (findings.length === 0) return "No evidence-backed collapse patterns detected.";
  return "Intelligence data is available.";
}

function summaryFor(readiness: IntelligenceReadiness, findings: IntelligenceFinding[], criticalEvents: CriticalEvent[]): string {
  if (findings.length === 0 && criticalEvents.length === 0) {
    return "Entropy did not find supported critical-event clusters in this report. That is a data-backed absence, not a clean bill of health.";
  }

  const top = [...findings].sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity])[0];
  if (top) return top.summary;
  if (readiness === "review") return "Critical events exist, but none currently combine into a supported finding.";
  return "Critical event data is present for inspection.";
}

function actionForFinding(finding: IntelligenceFinding): IntelligenceAction {
  if (finding.recommendation) {
    return {
      id: finding.recommendation.id,
      title: finding.recommendation.title,
      detail: finding.recommendation.detail,
      basedOn: finding.recommendation.basedOn,
      confidence: finding.recommendation.confidence,
    };
  }

  const title = finding.title;
  if (finding.title === "Defensive collapse") {
    return {
      id: `action:${finding.id}`,
      title: "Audit defensive call timing",
      detail: "Review stability, stunbreak, cleanse, barrier, and invuln timing around this engagement before changing composition.",
      basedOn: [finding.id],
      confidence: finding.confidence,
    };
  }
  if (finding.title === "Positioning collapse") {
    return {
      id: `action:${finding.id}`,
      title: "Review tag follow and regroup discipline",
      detail: "Use the engagement evidence to identify whether downs happened during split positioning, late regroups, or over-extension.",
      basedOn: [finding.id],
      confidence: finding.confidence,
    };
  }
  if (finding.title === "Spike collapse") {
    return {
      id: `action:${finding.id}`,
      title: "Pre-call enemy spike windows",
      detail: "Mark the spike timing and compare defensive coverage just before the enemy damage window lands.",
      basedOn: [finding.id],
      confidence: finding.confidence,
    };
  }
  if (finding.title === "Failed recovery cluster") {
    return {
      id: `action:${finding.id}`,
      title: "Tighten recovery assignments",
      detail: "Check whether recovery failed from missing rez pressure, insufficient peel, or deaths that happened after downs were already stabilized.",
      basedOn: [finding.id],
      confidence: finding.confidence,
    };
  }

  return {
    id: `action:${finding.id}`,
    title: `Review ${title.toLowerCase()}`,
    detail: "Inspect the supporting evidence and compare it against comms, comp, and positioning before making changes.",
    basedOn: [finding.id],
    confidence: finding.confidence,
  };
}

function actionPlan(findings: IntelligenceFinding[]): IntelligenceAction[] {
  const seen = new Set<string>();
  return [...findings]
    .sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity])
    .map(actionForFinding)
    .filter((action) => {
      const key = action.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function pressureLabelFor(score: number): IntelligenceEngagementInsight["pressureLabel"] {
  if (score >= 80) return "critical";
  if (score >= 55) return "danger";
  if (score >= 25) return "watch";
  return "quiet";
}

function reviewPromptFor(segment: EngagementSegment, topFinding?: IntelligenceFinding): string {
  if (topFinding?.title === "Defensive collapse") return "Review defensive cooldown timing before the first clustered downs.";
  if (topFinding?.title === "Positioning collapse") return "Watch player spacing and regroup pathing before this pressure window.";
  if (topFinding?.title === "Spike collapse") return "Compare enemy spike timing against squad mitigation coverage.";
  if (topFinding?.title === "Failed recovery cluster") return "Check rez pressure, peel, and whether downs converted into deaths too quickly.";
  if (segment.deaths > 0) return "Start with death recaps and the 15 seconds before each death.";
  if (segment.downs > 0) return "Review why downs happened and whether recovery stabilized cleanly.";
  return "Low pressure window; use as baseline comparison against higher-risk fights.";
}

function evidencePointsFor(segment: EngagementSegment, segmentFindings: IntelligenceFinding[]): string[] {
  const points = [
    `${segment.downs} squad down${segment.downs === 1 ? "" : "s"}`,
    `${segment.deaths} squad death${segment.deaths === 1 ? "" : "s"}`,
    `${segment.criticalEventIds.length} critical event${segment.criticalEventIds.length === 1 ? "" : "s"}`,
  ];

  const topFinding = segmentFindings[0];
  if (topFinding) points.unshift(topFinding.summary);
  if (segment.confidence !== "high") points.push(`${segment.confidence} confidence window`);
  return points.slice(0, 5);
}

function findingsBySegment(findings: IntelligenceFinding[]): Map<string, IntelligenceFinding[]> {
  const bySegment = new Map<string, IntelligenceFinding[]>();
  for (const finding of findings) {
    const segmentId = finding.id.split(":").slice(2).join(":");
    const list = bySegment.get(segmentId) ?? [];
    list.push(finding);
    bySegment.set(segmentId, list);
  }
  for (const [segmentId, segmentFindings] of bySegment) {
    bySegment.set(
      segmentId,
      [...segmentFindings].sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]),
    );
  }
  return bySegment;
}

function engagementInsights(segments: EngagementSegment[], findings: IntelligenceFinding[]): IntelligenceEngagementInsight[] {
  const bySegment = findingsBySegment(findings);

  return segments
    .map((segment) => {
      const segmentFindings = bySegment.get(segment.id) ?? [];
      const topFinding = segmentFindings[0];
      const severityScore = topFinding ? SEVERITY_WEIGHT[topFinding.severity] * 16 : 0;
      const pressureScore = Math.min(
        100,
        Math.round(segment.downs * 8 + segment.deaths * 18 + segment.criticalEventIds.length * 12 + severityScore),
      );
      const pressureLabel = pressureLabelFor(pressureScore);

      return {
        id: segment.id,
        label: segment.note ?? `Engagement ${segment.index + 1}`,
        fightId: segment.fightId,
        timestampMs: segment.start.timestampMs,
        pressureScore,
        pressurePercent: Math.max(4, pressureScore),
        pressureLabel,
        priority: 0,
        state: segment.state,
        downs: segment.downs,
        deaths: segment.deaths,
        criticalEvents: segment.criticalEventIds.length,
        findings: segmentFindings,
        topFinding,
        reviewPrompt: reviewPromptFor(segment, topFinding),
        evidencePoints: evidencePointsFor(segment, segmentFindings),
      };
    })
    .sort(
      (a, b) =>
        PRESSURE_LABEL_WEIGHT[b.pressureLabel] - PRESSURE_LABEL_WEIGHT[a.pressureLabel] ||
        b.pressureScore - a.pressureScore ||
        a.timestampMs - b.timestampMs,
    )
    .map((insight, index) => ({ ...insight, priority: index + 1 }));
}

function timelineItems(segments: EngagementSegment[], findings: IntelligenceFinding[]): IntelligenceTimelineItem[] {
  const findingBySegment = findingsBySegment(findings);

  return segments
    .map((segment) => {
      const segmentFindings = findingBySegment.get(segment.id) ?? [];
      const topFinding = [...segmentFindings].sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity])[0];
      return {
        id: segment.id,
        label: segment.note ?? `Engagement ${segment.index + 1}`,
        timestampMs: segment.start.timestampMs,
        severity: topFinding?.severity ?? (segment.deaths > 0 ? "significant" : segment.downs > 0 ? "notable" : "info"),
        category: topFinding?.category ?? "other",
        detail: topFinding?.title ?? segment.state,
        downs: segment.downs,
        deaths: segment.deaths,
        criticalEvents: segment.criticalEventIds.length,
      };
    })
    .sort((a, b) => b.deaths - a.deaths || b.downs - a.downs || b.criticalEvents - a.criticalEvents || a.timestampMs - b.timestampMs)
    .slice(0, 8);
}

export function buildIntelligenceDashboard(report: WvWReport): IntelligenceDashboard {
  const persisted =
    "engagementSegments" in report.stats ||
    "criticalEvents" in report.stats ||
    "intelligenceFindings" in report.stats;

  const segments = persisted ? report.stats.engagementSegments ?? [] : buildFallbackSegments(report);
  const persistedCriticalEvents = persisted ? report.stats.criticalEvents ?? [] : [];
  const deathRecapEvents = buildDeathRecapCriticalEvents(report);
  const criticalEvents = [...persistedCriticalEvents, ...deathRecapEvents].sort((a, b) => a.timestampMs - b.timestampMs);
  const findings = persisted
    ? report.stats.intelligenceFindings ?? []
    : synthesizeFindings({ fightId: report.meta.id, segments, criticalEvents });

  const totals = {
    downs: segments.reduce((sum, segment) => sum + segment.downs, 0),
    deaths: segments.reduce((sum, segment) => sum + segment.deaths, 0),
    segments: segments.length,
    criticalEvents: criticalEvents.length,
    findings: findings.length,
  };
  const readiness = readinessFor(findings, totals.deaths);
  const engagements = engagementInsights(segments, findings);

  return {
    persisted,
    readiness,
    headline: headlineFor(readiness, findings, persisted),
    summary: summaryFor(readiness, findings, criticalEvents),
    segments,
    criticalEvents,
    findings,
    engagements,
    timeline: timelineItems(segments, findings),
    actions: actionPlan(findings),
    severityCounts: severityCounts(findings),
    categoryCounts: categoryCounts(findings),
    totals,
    coverage: {
      replay: Boolean(report.stats.replayFights?.length),
      mechanics: Boolean(report.stats.mechanics?.fights?.length),
      deathRecaps: Boolean(report.stats.deathRecaps?.length),
      survivalSupport: Boolean(report.stats.survivalSupport?.length),
      fightRows: Boolean(report.stats.fightBreakdown?.length),
    },
  };
}
