export type BurstDamageScope = "all-targets" | "enemy-players";

export interface BurstDamageInput {
  durationMs: number;
  scope: BurstDamageScope;
  /** Cumulative samples at 0, 1000, 2000...ms, plus the final partial endpoint. */
  points: readonly number[];
}

export type BurstDamageResult =
  | {
      status: "available";
      definition: "log-aligned-1s-v1";
      scope: BurstDamageScope;
      damage: number;
      startMs: number;
      endMs: number;
      intervals: number;
    }
  | {
      status: "unavailable";
      reason: "invalid-duration" | "no-full-second" | "incomplete-series" | "invalid-series";
    };

/** Read-only analysis. Scope must be established by the caller, not inferred from values. */
export function peakOneSecondDamage({ durationMs, scope, points }: BurstDamageInput): BurstDamageResult {
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0) {
    return { status: "unavailable", reason: "invalid-duration" };
  }
  const intervals = Math.floor(durationMs / 1000);
  if (intervals === 0) return { status: "unavailable", reason: "no-full-second" };

  // Requiring the full EI shape avoids silently treating a truncated fight as complete.
  if (points.length !== Math.ceil(durationMs / 1000) + 1) {
    return { status: "unavailable", reason: "incomplete-series" };
  }
  for (let i = 0; i < points.length; i++) {
    if (!Number.isSafeInteger(points[i]) || points[i] < 0 || (i > 0 && points[i] < points[i - 1])) {
      return { status: "unavailable", reason: "invalid-series" };
    }
  }
  if (points[0] !== 0) return { status: "unavailable", reason: "invalid-series" };

  let damage = -1;
  let endMs = 1000;
  for (let i = 1; i <= intervals; i++) {
    const candidate = points[i] - points[i - 1];
    // Strict comparison retains the earliest interval when peaks tie.
    if (candidate > damage) {
      damage = candidate;
      endMs = i * 1000;
    }
  }
  return {
    status: "available",
    definition: "log-aligned-1s-v1",
    scope,
    damage,
    startMs: endMs - 1000,
    endMs,
    intervals,
  };
}
