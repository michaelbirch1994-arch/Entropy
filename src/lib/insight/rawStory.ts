import type { RawCapture, RawEncounterMatch } from './rawCapture';
export const storyLanes = ['Casts', 'Buff changes', 'Downs / deaths'] as const;
export function storyLane(kind: string) {
  if (kind.startsWith('Animation')) return 'Casts';
  if (kind.startsWith('Buff')) return 'Buff changes';
  if (kind === 'Down' || kind === 'Dead') return 'Downs / deaths';
  return null;
}
export function buildRawStory(capture: RawCapture, encounter: RawEncounterMatch) {
  const start = encounter.startTick, end = encounter.endTick;
  if (encounter.status !== 'start-matched' || start === null || end === null || end <= start) return null;
  const events = capture.events.filter(e => e.stream === 'area' && e.tick !== null && e.tick >= start && e.tick <= end && storyLane(e.kind))
    .sort((a, b) => a.tick! - b.tick! || a.sequence.localeCompare(b.sequence));
  const duration = end - start;
  // Fixed bins keep large captures interactive without concealing aggregation.
  const bins = storyLanes.map(lane => Array.from({ length: 80 }, (_, index) => ({ lane, index, count: 0, startMs: index * duration / 80 })));
  for (const event of events) {
    const lane = storyLanes.indexOf(storyLane(event.kind)!);
    bins[lane][Math.min(79, Math.floor((event.tick! - start) / duration * 80))].count++;
  }
  return { start, end, duration, events, bins };
}
