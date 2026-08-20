import type { ReplayPreEventChanges, ReplayPreEventMetric } from "./replayPreEventChanges";

export interface ReplayEventNarrativeStatement {
  key: ReplayPreEventMetric["key"];
  text: string;
  priority: number;
}

export interface ReplayEventNarrative {
  headline: string;
  statements: ReplayEventNarrativeStatement[];
  evidenceKeys: ReplayPreEventMetric["key"][];
  fallback: string | null;
}

const COUNT_THRESHOLD = 1;
const AVERAGE_THRESHOLD = 0.5;
const MAX_STATEMENTS = 2;

const BASE_PRIORITY: Record<ReplayPreEventMetric["key"], number> = {
  downOrDead: 100,
  beyond600FromTag: 80,
  stability: 75,
  nearbySquad240: 60,
  nearbyEnemies600: 50,
};

function isMaterial(metric: ReplayPreEventMetric): boolean {
  const threshold = metric.format === "average" ? AVERAGE_THRESHOLD : COUNT_THRESHOLD;
  return Math.abs(metric.delta) >= threshold;
}

function formatValue(metric: ReplayPreEventMetric, value: number): string {
  return metric.format === "average" ? value.toFixed(1) : String(Math.round(value));
}

function formatCoverageValue(metric: ReplayPreEventMetric, value: number, coverage: number): string {
  return `${formatValue(metric, value)}/${coverage}`;
}

function statementText(metric: ReplayPreEventMetric): string {
  const before = formatValue(metric, metric.before);
  const atEvent = formatValue(metric, metric.atEvent);
  const increased = metric.delta > 0;

  switch (metric.key) {
    case "downOrDead":
      return `Down/dead participants ${increased ? "increased" : "decreased"} from ${before} to ${atEvent}.`;
    case "beyond600FromTag":
      return `Participants beyond 600 from tag ${increased ? "increased" : "decreased"} from ${before} to ${atEvent}.`;
    case "stability": {
      const beforeCoverage = formatCoverageValue(metric, metric.before, metric.coverageBefore);
      const eventCoverage = formatCoverageValue(metric, metric.atEvent, metric.coverageAtEvent);
      return `Stability presence ${increased ? "increased" : "decreased"} from ${beforeCoverage} to ${eventCoverage} tracked participants.`;
    }
    case "nearbySquad240":
      return `Average nearby squad support within 240 ${increased ? "rose" : "fell"} from ${before} to ${atEvent}.`;
    case "nearbyEnemies600":
      return `Average tracked enemies within 600 ${increased ? "rose" : "fell"} from ${before} to ${atEvent}.`;
  }
}

function statementPriority(metric: ReplayPreEventMetric): number {
  const magnitude = metric.format === "average" ? Math.abs(metric.delta) : Math.abs(Math.round(metric.delta));
  return BASE_PRIORITY[metric.key] + Math.min(magnitude, 10);
}

/**
 * Convert proven Replay pre-event changes into a short commander-readable
 * description. The output is deterministic and deliberately non-causal:
 * it describes only material tracked changes and preserves evidence keys for
 * later drill-down behavior.
 */
export function buildReplayEventNarrative(changes: ReplayPreEventChanges | null): ReplayEventNarrative | null {
  if (!changes) return null;

  if (changes.metrics.length === 0) {
    return {
      headline: "What changed before this event",
      statements: [],
      evidenceKeys: [],
      fallback: "No comparable tracked state was available at both endpoints.",
    };
  }

  const statements = changes.metrics
    .filter(isMaterial)
    .map((metric) => ({
      key: metric.key,
      text: statementText(metric),
      priority: statementPriority(metric),
    }))
    .sort((left, right) => right.priority - left.priority || left.key.localeCompare(right.key))
    .slice(0, MAX_STATEMENTS);

  return {
    headline: "What changed before this event",
    statements,
    evidenceKeys: statements.map((statement) => statement.key),
    fallback: statements.length === 0
      ? "No material tracked state changes crossed the current display thresholds in the previous 5 seconds."
      : null,
  };
}
