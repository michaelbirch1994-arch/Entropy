import { expect, it } from 'vitest';
import { playerSkillTimeline } from '../insight/playerSkillTimeline';

const cast = (skillId: number, castTime: number) => ({ skillId, castTime, duration: 0 });

it('sorts, deduplicates, and bounds recorded casts to the fight', () => {
  const timeline = playerSkillTimeline([
    cast(1, 9_000), cast(1, 1_000), cast(1, 1_000), cast(2, 2_000), cast(1, -1), cast(1, 12_000),
  ], 1, 10_000, null);
  expect(timeline.markers).toEqual([
    { timeMs: 1_000, conflictWithPrevious: false },
    { timeMs: 9_000, conflictWithPrevious: false },
  ]);
  expect(timeline.windows).toEqual([]);
});

it('merges overlapping base-recharge windows and clips them at fight end', () => {
  const timeline = playerSkillTimeline([cast(1, 1_000), cast(1, 6_000), cast(1, 29_000)], 1, 30_000, 10_000);
  expect(timeline.windows).toEqual([
    { startMs: 1_000, endMs: 16_000 },
    { startMs: 29_000, endMs: 30_000 },
  ]);
});

it('flags reuse sooner than the base reference while preserving every cast marker', () => {
  const timeline = playerSkillTimeline([cast(1, 1_000), cast(1, 6_000), cast(1, 16_000)], 1, 30_000, 10_000);
  expect(timeline.markers).toEqual([
    { timeMs: 1_000, conflictWithPrevious: false },
    { timeMs: 6_000, conflictWithPrevious: true },
    { timeMs: 16_000, conflictWithPrevious: false },
  ]);
});

it('keeps casts visible when the recharge reference is invalid', () => {
  const timeline = playerSkillTimeline([cast(1, 2_000)], 1, Number.NaN, 0);
  expect(timeline).toMatchObject({ durationMs: 0, baseMs: null, windows: [], markers: [] });
});
