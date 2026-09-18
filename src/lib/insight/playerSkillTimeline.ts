import type { RotationCast } from '../../types/report';

export interface PlayerSkillTimelineMarker {
  timeMs: number;
  conflictWithPrevious: boolean;
}

export interface PlayerSkillReferenceWindow {
  startMs: number;
  endMs: number;
}

export interface PlayerSkillTimeline {
  durationMs: number;
  markers: PlayerSkillTimelineMarker[];
  windows: PlayerSkillReferenceWindow[];
  baseMs: number | null;
}

/** Recorded casts plus a base-recharge overlay. This is not an availability verdict. */
export function playerSkillTimeline(
  casts: RotationCast[],
  skillId: number,
  durationMs: number,
  baseMs: number | null,
  unexplainedGapEndMs?: number[],
): PlayerSkillTimeline {
  const duration = Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0;
  const reference = typeof baseMs === 'number' && Number.isFinite(baseMs) && baseMs > 0 ? baseMs : null;
  const times = [...new Set(casts
    .filter((cast) => cast.skillId === skillId
      && Number.isFinite(cast.castTime)
      && cast.castTime >= 0
      && cast.castTime <= duration)
    .map((cast) => cast.castTime))]
    .sort((a, b) => a - b);

  const unresolved = unexplainedGapEndMs ? new Set(unexplainedGapEndMs) : null;
  const markers = times.map((timeMs, index) => ({
    timeMs,
    conflictWithPrevious: unresolved ? unresolved.has(timeMs) : reference !== null && index > 0 && timeMs - times[index - 1] < reference,
  }));

  if (reference === null) return { durationMs: duration, markers, windows: [], baseMs: null };

  const windows = times.reduce<PlayerSkillReferenceWindow[]>((merged, startMs) => {
    const window = { startMs, endMs: Math.min(duration, startMs + reference) };
    const previous = merged.at(-1);
    if (previous && window.startMs <= previous.endMs) previous.endMs = Math.max(previous.endMs, window.endMs);
    else merged.push(window);
    return merged;
  }, []);

  return { durationMs: duration, markers, windows, baseMs: reference };
}
