import type { ActivityBin } from './executionActivity';

export interface BurstConfig { baselineBinsEachSide: number; minimumDamage: number; minimumExcess: number; minimumRatio: number }
export interface ExecutionPressureCandidate {
  startMs: number;
  endMs: number;
  damage: number;
  baseline: number;
  excess: number;
  ratio: number | null;
}

export interface ExecutionPressureResult {
  method: 'experimental-local-damage-peaks-v1';
  config: BurstConfig;
  candidates: ExecutionPressureCandidate[];
  excludedWindows: number;
  limitations: string[];
}

/** Experimental one-second local maxima; not engagement or player-sync detection. */
export function executionBursts(bins: ActivityBin[], config: BurstConfig): ExecutionPressureResult {
  const { baselineBinsEachSide: radius, minimumDamage, minimumExcess, minimumRatio } = config;
  if (!Number.isInteger(radius) || radius < 2 || radius > 60 || ![minimumDamage, minimumExcess, minimumRatio].every(Number.isFinite) || minimumDamage <= 0 || minimumExcess <= 0 || minimumRatio <= 1) throw Error('Invalid experimental burst thresholds');
  const candidates: ExecutionPressureCandidate[] = [];
  let excludedWindows = 0;
  for (let i = radius; i < bins.length - radius; i++) {
    const neighborhood = bins.slice(i - radius, i + radius + 1);
    const valid = neighborhood.every((b, j) => b.state !== 'unknown' && b.damage !== null && Number.isFinite(b.damage) && b.damage >= 0 && b.endMs - b.startMs === 1000 && (j === 0 || neighborhood[j - 1].endMs === b.startMs));
    if (!valid) { excludedWindows++; continue; }
    const peak = bins[i];
    // Strict local maximum avoids selecting many points on a sustained plateau.
    if (peak.damage! <= bins[i - 1].damage! || peak.damage! <= bins[i + 1].damage!) continue;
    const values = neighborhood.filter((_, j) => j !== radius).map(b => b.damage!).sort((a, b) => a - b);
    const baseline = (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
    const excess = peak.damage! - baseline;
    if (peak.damage! < minimumDamage || excess < minimumExcess || peak.damage! < baseline * minimumRatio) continue;
    candidates.push({ startMs: peak.startMs, endMs: peak.endMs, damage: peak.damage!, baseline, excess, ratio: baseline > 0 ? peak.damage! / baseline : null });
  }
  return { method: 'experimental-local-damage-peaks-v1', config: { ...config }, candidates, excludedWindows,
    limitations: ['All-target damage, not verified enemy-player pressure.', 'One-second peak intervals, not exact cast times.', 'Flat peaks and boundary windows are intentionally not classified.', 'Thresholds are experimental; no performance grade or synchronization score.'] };
}
