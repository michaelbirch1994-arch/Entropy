import type { ReplayPlayerTrack } from '../parseReplayData';

export const READINESS_BOONS = ['Stability', 'Protection', 'Aegis', 'Swiftness'] as const;

function transitions(player: ReplayPlayerTrack, name: string) {
  const tracks = player.effects.filter(e => e.classification === 'Boon' && e.name.toLowerCase() === name.toLowerCase());
  if (tracks.length !== 1) return [];
  const groups = new Map<number, number[]>();
  for (const [t, v] of tracks[0].states) {
    if (!Number.isFinite(t) || t < 0) continue;
    const group = groups.get(t) ?? [];
    group.push(v); groups.set(t, group);
  }
  return [...groups].sort(([a], [b]) => a - b).map(([t, values]) => ({ t,
    value: values.every(v => Number.isFinite(v) && v >= 0 && v === values[0]) ? values[0] : null }));
}
export function measureReadiness(players: ReplayPlayerTrack[], timeMs: number, durationMs: number) {
  const roster = players.filter(p => p.inSquad === true);
  return READINESS_BOONS.map(name => {
    const members = roster.map(p => {
      let value: number | null = null;
      if (Number.isFinite(timeMs) && timeMs >= 0 && timeMs < durationMs) {
        for (const state of transitions(p, name)) {
          if (state.t > timeMs) break;
          value = state.value;
        }
      }
      return { account: p.account, name: p.name, profession: p.profession, value,
        state: value === null ? 'unknown' as const : value > 0 ? 'present' as const : 'absent' as const };
    });
    const total = members.length;
    const present = members.filter(p => p.state === 'present').length;
    const absent = members.filter(p => p.state === 'absent').length;
    const known = present + absent;
    const unknown = total - known;
    return { name, members, total, present, absent, unknown,
      observedCoverage: known ? present / known : null,
      evidenceCoverage: total ? known / total : null,
      bounds: total ? [present / total, (present + unknown) / total] as [number, number] : null };
  });
}

/** Compare both plausible edges of an imprecise analysis anchor without inventing sub-bin timing. */
export function measureReadinessBoundary(players: ReplayPlayerTrack[], boundsMs: [number, number] | undefined, durationMs: number) {
  if (!boundsMs || !boundsMs.every(Number.isFinite) || boundsMs[0] < 0 || boundsMs[1] < boundsMs[0] || boundsMs[0] >= durationMs) return null;
  const startMs = boundsMs[0];
  const endMs = Math.min(boundsMs[1], durationMs - 1);
  const start = measureReadiness(players, startMs, durationMs);
  const end = measureReadiness(players, endMs, durationMs);
  return { boundsMs: [startMs, endMs] as [number, number], results: start.map((first, index) => {
    const last = end[index];
    const observed = [first.observedCoverage, last.observedCoverage].filter((value): value is number => value !== null);
    const evidence = [first.evidenceCoverage, last.evidenceCoverage].filter((value): value is number => value !== null);
    const fullBounds = [first.bounds, last.bounds].filter((value): value is [number, number] => value !== null);
    return {
      name: first.name,
      start: { present: first.present, absent: first.absent, unknown: first.unknown, observedCoverage: first.observedCoverage, evidenceCoverage: first.evidenceCoverage, bounds: first.bounds },
      end: { present: last.present, absent: last.absent, unknown: last.unknown, observedCoverage: last.observedCoverage, evidenceCoverage: last.evidenceCoverage, bounds: last.bounds },
      observedCoverageRange: observed.length ? [Math.min(...observed), Math.max(...observed)] as [number, number] : null,
      evidenceCoverageRange: evidence.length ? [Math.min(...evidence), Math.max(...evidence)] as [number, number] : null,
      fullSquadBoundsEnvelope: fullBounds.length ? [Math.min(...fullBounds.map(value => value[0])), Math.max(...fullBounds.map(value => value[1]))] as [number, number] : null,
      boundarySensitive: first.present !== last.present || first.absent !== last.absent || first.unknown !== last.unknown,
    };
  }) };
}

export interface ReadinessSpan { startMs: number; endMs: number; state: 'present' | 'absent' | 'unknown' }

/** Integrate recorded transitions, not sampled snapshots or interpolated uptime. */
export function measureReadinessWindow(players: ReplayPlayerTrack[], name: string, centerMs: number, radiusMs: number, durationMs: number) {
  const valid = [centerMs, radiusMs, durationMs].every(Number.isFinite) && radiusMs > 0 && durationMs > 0 && centerMs >= 0 && centerMs < durationMs;
  const startMs = valid ? Math.max(0, centerMs - radiusMs) : 0;
  const endMs = valid ? Math.min(durationMs, centerMs + radiusMs) : 0;
  const center = valid ? centerMs : 0;
  const members = players.filter(p => p.inSquad === true).map(p => {
    const spans: ReadinessSpan[] = [];
    let cursor = startMs;
    let value: number | null = null;
    const append = (end: number) => {
      if (end > cursor) spans.push({ startMs: cursor, endMs: end, state: value === null ? 'unknown' : value > 0 ? 'present' : 'absent' });
      cursor = end;
    };
    for (const transition of transitions(p, name)) {
      if (transition.t <= startMs) { value = transition.value; continue; }
      if (transition.t >= endMs) break;
      append(transition.t); value = transition.value;
    }
    append(endMs);
    return { account: p.account, name: p.name, profession: p.profession, spans };
  });
  const integrate = (from: number, to: number) => {
    let presentMs = 0, absentMs = 0, unknownMs = 0;
    for (const member of members) for (const span of member.spans) {
      const elapsed = Math.max(0, Math.min(to, span.endMs) - Math.max(from, span.startMs));
      if (span.state === 'present') presentMs += elapsed;
      else if (span.state === 'absent') absentMs += elapsed;
      else unknownMs += elapsed;
    }
    const knownMs = presentMs + absentMs;
    const totalMs = knownMs + unknownMs;
    return { startMs: from, endMs: to, presentMs, absentMs, unknownMs, totalMs,
      observedCoverage: knownMs ? presentMs / knownMs : null,
      evidenceCoverage: totalMs ? knownMs / totalMs : null,
      bounds: totalMs ? [presentMs / totalMs, (presentMs + unknownMs) / totalMs] as [number, number] : null };
  };
  return { startMs, centerMs: center, endMs, members, before: integrate(startMs, center), after: integrate(center, endMs) };
}
