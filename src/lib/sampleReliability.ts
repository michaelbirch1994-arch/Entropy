export type SampleReliabilityLevel = "low" | "moderate" | "strong";

export interface SampleReliability {
  level: SampleReliabilityLevel;
  label: string;
  coverage: number;
  detail: string;
}

const LOW_ACTIVE_SAMPLE_MS = 3 * 60 * 1000;
const DEVELOPING_ACTIVE_SAMPLE_MS = 10 * 60 * 1000;
const LOW_AVERAGE_FIGHT_MS = 20 * 1000;
const DEVELOPING_AVERAGE_FIGHT_MS = 45 * 1000;

function durationSummary(activeMs: number, fights: number): string {
  const totalMinutes = activeMs / 60_000;
  const averageSeconds = fights > 0 ? activeMs / fights / 1000 : 0;
  const totalLabel = totalMinutes >= 10 ? `${Math.round(totalMinutes)} minutes` : `${totalMinutes.toFixed(1)} minutes`;
  return `${totalLabel} tracked (${Math.round(averageSeconds)} seconds per fight)`;
}

/**
 * Describes how much confidence a viewer should place in an aggregate without
 * changing the aggregate itself. Fight count protects against a one-night
 * outlier while coverage prevents a late arrival from looking equivalent to a
 * full-session player.
 */
export function getSampleReliability(fights: number, totalFights: number, activeMs?: number): SampleReliability {
  const safeFights = Math.max(0, Math.floor(Number(fights) || 0));
  const safeTotal = Math.max(safeFights, Math.floor(Number(totalFights) || 0));
  const coverage = safeTotal > 0 ? safeFights / safeTotal : 0;
  const numericActiveMs = Number(activeMs);
  const safeActiveMs = Number.isFinite(numericActiveMs) ? Math.max(0, numericActiveMs) : 0;
  const durationKnown = safeActiveMs > 0 && safeFights > 0;
  const averageFightMs = durationKnown ? safeActiveMs / safeFights : 0;
  const durationDetail = durationKnown ? ` Active combat: ${durationSummary(safeActiveMs, safeFights)}.` : "";

  if (safeFights < 3 || coverage < 0.25) {
    return {
      level: "low",
      label: "Low sample",
      coverage,
      detail: `${safeFights} of ${safeTotal} fights; treat this as directional, not a stable trend.${durationDetail}`,
    };
  }

  if (durationKnown && (safeActiveMs < LOW_ACTIVE_SAMPLE_MS || averageFightMs < LOW_AVERAGE_FIGHT_MS)) {
    return {
      level: "low",
      label: "Short sample",
      coverage,
      detail: `${safeFights} of ${safeTotal} fights, but only ${durationSummary(safeActiveMs, safeFights)}; rate metrics may be highly volatile.`,
    };
  }

  if (
    safeFights < 6
    || coverage < 0.6
    || (durationKnown && (safeActiveMs < DEVELOPING_ACTIVE_SAMPLE_MS || averageFightMs < DEVELOPING_AVERAGE_FIGHT_MS))
  ) {
    return {
      level: "moderate",
      label: "Developing sample",
      coverage,
      detail: `${safeFights} of ${safeTotal} fights; useful context, but still sensitive to a few fights.${durationDetail}`,
    };
  }

  return {
    level: "strong",
    label: "Strong sample",
    coverage,
    detail: `${safeFights} of ${safeTotal} fights; broad enough for a more stable session comparison.${durationDetail}`,
  };
}

export function sampleReliabilityClasses(level: SampleReliabilityLevel): string {
  switch (level) {
    case "strong":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "moderate":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    default:
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  }
}
