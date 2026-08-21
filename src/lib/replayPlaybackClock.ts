export const REPLAY_RENDER_INTERVAL_MS = 1000 / 30;
export const REPLAY_ANALYSIS_INTERVAL_MS = 200;

export interface ReplayClockAnchor {
  timelineMs: number;
  wallClockMs: number;
}

/**
 * Resolve playback from one monotonic wall-clock anchor. This avoids adding
 * frame deltas to React state, which can accumulate drift when a render is
 * delayed. A delayed frame may be visually skipped, but the replay clock and
 * actor positions always resolve from the same authoritative timestamp.
 */
export function resolveReplayPlaybackTime(
  anchor: ReplayClockAnchor,
  nowMs: number,
  speed: number,
  durationMs: number,
): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 0;
  const safeSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1;
  const elapsedMs = Math.max(0, nowMs - anchor.wallClockMs) * safeSpeed;
  const candidate = Math.max(0, anchor.timelineMs) + elapsedMs;
  return candidate % durationMs;
}

/**
 * Expensive tactical and Intelligence summaries do not need animation-frame
 * precision. Quantizing their timestamp keeps actor motion responsive while
 * retaining sub-second evidence alignment.
 */
export function quantizeReplayAnalysisTime(
  timestampMs: number,
  intervalMs = REPLAY_ANALYSIS_INTERVAL_MS,
): number {
  if (!Number.isFinite(timestampMs)) return 0;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return Math.max(0, timestampMs);
  return Math.max(0, Math.floor(timestampMs / intervalMs) * intervalMs);
}
