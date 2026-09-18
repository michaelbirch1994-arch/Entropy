import type { CompanionEvent, CompanionRecording } from './companionRecording';

export interface ReferenceCast { skillId: number; timeMs: number }

/** Compare independent observations; never infer clock offsets or missing casts. */
export function compareCompanionCasts(recording: CompanionRecording, reference: ReferenceCast[], toleranceMs: number) {
  if (!Number.isSafeInteger(toleranceMs) || toleranceMs < 0 || toleranceMs > 5000) throw new Error('Timing tolerance must be 0-5000 ms.');
  if (reference.some(c => !Number.isSafeInteger(c.skillId) || c.skillId <= 0 || !Number.isFinite(c.timeMs) || c.timeMs < 0 || c.timeMs > recording.encounter.durationMs)) throw new Error('Invalid reference cast.');
  const casts = recording.events.filter((e): e is Extract<CompanionEvent, { kind: 'cast' }> => e.kind === 'cast' && e.source === 'collector-observed');
  const window = toleranceMs + recording.clock.uncertaintyMs;
  const outsideGap = (time: number) => !recording.gaps.some(g => g.startMs <= time + window && g.endMs > time - window);
  // Require unique matches in both directions so repeated rapid casts cannot
  // manufacture agreement by reusing a reference event.
  const options = casts.map(c => outsideGap(c.timeMs)
    ? reference.flatMap((r, index) => r.skillId === c.skillId && Math.abs(r.timeMs - c.timeMs) <= window ? [index] : []) : []);
  const claims = new Map<number, number>();
  options.flat().forEach(index => claims.set(index, (claims.get(index) ?? 0) + 1));
  const results = casts.map((c, index) => {
    const candidates = options[index];
    const status = !outsideGap(c.timeMs) ? 'gap' : candidates.length === 0 ? 'unmatched'
      : candidates.length !== 1 || claims.get(candidates[0]) !== 1 ? 'ambiguous' : 'matched';
    const r = status === 'matched' ? reference[candidates[0]] : undefined;
    return { sequence: c.sequence, skillId: c.skillId, timeMs: c.timeMs, status,
      referenceTimeMs: r?.timeMs ?? null, differenceMs: r ? c.timeMs - r.timeMs : null };
  });
  const matched = results.filter(r => r.status === 'matched');
  return {
    toleranceMs, clockUncertaintyMs: recording.clock.uncertaintyMs,
    claimedObservedCasts: casts.length, referenceCasts: reference.length,
    matched: matched.length, ambiguous: results.filter(r => r.status === 'ambiguous').length,
    unmatched: results.filter(r => r.status === 'unmatched').length,
    suppressedByGaps: results.filter(r => r.status === 'gap').length,
    matchRatePercent: casts.length ? Math.round(100 * matched.length / casts.length) : null,
    maximumAbsoluteDifferenceMs: matched.length ? Math.max(...matched.map(r => Math.abs(r.differenceMs!))) : null,
    results,
    interpretation: 'Agreement with supplied reference casts, not probability of skill readiness or authentication of the recording.',
  };
}
