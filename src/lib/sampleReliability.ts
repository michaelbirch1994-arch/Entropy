export type SampleReliabilityLevel = "low" | "moderate" | "strong";

export interface SampleReliability {
  level: SampleReliabilityLevel;
  label: string;
  coverage: number;
  detail: string;
}

/**
 * Describes how much confidence a viewer should place in an aggregate without
 * changing the aggregate itself. Fight count protects against a one-night
 * outlier while coverage prevents a late arrival from looking equivalent to a
 * full-session player.
 */
export function getSampleReliability(fights: number, totalFights: number): SampleReliability {
  const safeFights = Math.max(0, Math.floor(Number(fights) || 0));
  const safeTotal = Math.max(safeFights, Math.floor(Number(totalFights) || 0));
  const coverage = safeTotal > 0 ? safeFights / safeTotal : 0;

  if (safeFights < 3 || coverage < 0.25) {
    return {
      level: "low",
      label: "Low sample",
      coverage,
      detail: `${safeFights} of ${safeTotal} fights; treat this as directional, not a stable trend.`,
    };
  }

  if (safeFights < 6 || coverage < 0.6) {
    return {
      level: "moderate",
      label: "Developing sample",
      coverage,
      detail: `${safeFights} of ${safeTotal} fights; useful context, but still sensitive to a few fights.`,
    };
  }

  return {
    level: "strong",
    label: "Strong sample",
    coverage,
    detail: `${safeFights} of ${safeTotal} fights; broad enough for a more stable session comparison.`,
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
