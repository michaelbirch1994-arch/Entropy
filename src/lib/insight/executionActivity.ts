import { executionBursts, type BurstConfig, type ExecutionPressureCandidate } from './executionBursts';

interface DamageActor { account: string; series: unknown[][] }
export type ExecutionActivityScope = 'all-targets' | 'recorded-enemy-players';
export interface ActivityBin {
  startMs: number; endMs: number; observedPlayers: number; eligiblePlayers: number;
  damage: number | null; state: 'activity' | 'quiet' | 'unknown';
}

export interface ExecutionActivityCandidate {
  startMs: number;
  endMs: number;
  damage: number;
  bins: number;
}

export interface ExecutionActivitySummary {
  method: 'raw-damage-activity-v2';
  scope: ExecutionActivityScope;
  resolutionMs: 1000;
  durationMs: number;
  eligiblePlayers: number;
  selectedTargetCount: number | null;
  unknownTargetClassifications: number;
  fullFightPhase: boolean;
  duplicateAccounts: number;
  unidentifiedPlayers: number;
  unsupportedDuration: boolean;
  unmeasuredTailMs: number;
  coverage: {
    totalBins: number;
    knownBins: number;
    activityBins: number;
    quietBins: number;
    unknownBins: number;
    observedPlayerBins: number;
    eligiblePlayerBins: number;
    evidenceCoverage: number | null;
  };
  pressure: {
    method: 'experimental-local-damage-peaks-v1';
    config: BurstConfig;
    candidates: ExecutionPressureCandidate[];
    omittedCandidates: number;
    excludedWindows: number;
    limitations: string[];
  };
  candidates: ExecutionActivityCandidate[];
  omittedCandidates: number;
  sourceRefs: string[];
  limitations: string[];
}

export const EXECUTION_PRESSURE_CONFIG: BurstConfig = {
  baselineBinsEachSide: 2,
  minimumDamage: 1000,
  minimumExcess: 1000,
  minimumRatio: 2,
};

export interface ExecutionActivityFight {
  fightId: string;
  fightName: string;
  scopes: {
    recordedEnemyPlayers: ExecutionActivitySummary;
    allTargets: ExecutionActivitySummary;
  };
}

export interface ExecutionActivityData {
  fights: ExecutionActivityFight[];
}

/** Full-second raw EI damage deltas. Never use the graph's zero-filled squad sum. */
export function executionActivity(raw: unknown, scope: ExecutionActivityScope = 'all-targets') {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const durationMs = typeof source.durationMS === 'number' && Number.isFinite(source.durationMS) && source.durationMS > 0 ? source.durationMS : 0;
  const actors: DamageActor[] = [];
  const targets = Array.isArray(source.targets) ? source.targets : [];
  const selectedTargets = targets.flatMap((t, index) => t?.enemyPlayer === true ? [index] : []);
  const unknownTargetClassifications = targets.filter(t => typeof t?.enemyPlayer !== 'boolean').length;
  const phases = Array.isArray(source.phases) ? source.phases : [];
  const fullFightPhase = phases[0]?.start === 0 && phases[0]?.end === durationMs;
  let unidentifiedPlayers = 0;
  for (const value of Array.isArray(source.players) ? source.players : []) {
    if (!value || typeof value !== 'object' || value.notInSquad === true) continue;
    if (typeof value.account !== 'string' || !value.account) { unidentifiedPlayers++; continue; }
    const series = scope === 'all-targets'
      ? [Array.isArray(value.damage1S?.[0]) ? value.damage1S[0] : []]
      : fullFightPhase && Array.isArray(value.targetDamage1S) && value.targetDamage1S.length === targets.length
        ? selectedTargets.map(index => Array.isArray(value.targetDamage1S[index]?.[0]) ? value.targetDamage1S[index][0] : []) : [];
    actors.push({ account: value.account, series });
  }
  const counts = new Map<string, number>();
  for (const p of actors) counts.set(p.account, (counts.get(p.account) ?? 0) + 1);
  const unique = actors.filter(p => counts.get(p.account) === 1);
  const eligiblePlayers = counts.size + unidentifiedPlayers;
  const bins: ActivityBin[] = [];
  // Bound work for untrusted inputs; larger fights explicitly remain unsupported.
  if (durationMs <= 12 * 60 * 60 * 1000) for (let endMs = 1000; endMs <= durationMs; endMs += 1000) {
    const index = endMs / 1000;
    let observedPlayers = 0, damage = 0;
    for (const actor of unique) {
      let actorDamage = 0;
      const valid = actor.series.length > 0 && actor.series.every(points => {
        const before = points[index - 1], after = points[index];
        if (typeof before !== 'number' || typeof after !== 'number' || !Number.isFinite(before) || !Number.isFinite(after) || before < 0 || after < before) return false;
        actorDamage += after - before;
        return Number.isFinite(actorDamage);
      });
      if (!valid) continue;
      observedPlayers++; damage += actorDamage;
    }
    const complete = eligiblePlayers > 0 && observedPlayers === eligiblePlayers;
    bins.push({ startMs: endMs - 1000, endMs, observedPlayers, eligiblePlayers, damage: observedPlayers ? damage : null,
      state: !complete ? 'unknown' : damage > 0 ? 'activity' : 'quiet' });
  }
  const candidates: ExecutionActivityCandidate[] = [];
  for (const bin of bins) {
    if (bin.state !== 'activity') continue;
    const last = candidates.at(-1);
    if (last && last.endMs === bin.startMs) { last.endMs = bin.endMs; last.damage += bin.damage!; last.bins++; }
    else candidates.push({ startMs: bin.startMs, endMs: bin.endMs, damage: bin.damage!, bins: 1 });
  }
  return { method: 'raw-damage-activity-v2' as const, scope, selectedTargetIndices: scope === 'recorded-enemy-players' ? selectedTargets : null,
    unknownTargetClassifications, fullFightPhase, resolutionMs: 1000 as const, durationMs, eligiblePlayers,
    duplicateAccounts: [...counts.values()].filter(n => n > 1).length, unidentifiedPlayers,
    unsupportedDuration: durationMs > 12 * 60 * 60 * 1000, unmeasuredTailMs: durationMs % 1000,
    bins, candidates, limitations: ['Activity candidates are not engagements or synchronized spikes.',
      scope === 'all-targets' ? 'Damage1S target scope is not restricted to enemy players by this adapter.' : 'Only targets explicitly marked enemyPlayer are included; unknown classifications are excluded, not inferred.',
      'Complete means usable samples for the supplied roster, not proven complete combat recording.',
      'Unknown bins split candidates; no interpolation or gap filling.', 'Partial final seconds are not scored.'] };
}

/** Persist only the evidence needed to select and explain activity anchors. */
export function summarizeExecutionActivity(result: ReturnType<typeof executionActivity>): ExecutionActivitySummary {
  const totalBins = result.bins.length;
  const knownBins = result.bins.filter(bin => bin.state !== 'unknown').length;
  const activityBins = result.bins.filter(bin => bin.state === 'activity').length;
  const quietBins = result.bins.filter(bin => bin.state === 'quiet').length;
  const observedPlayerBins = result.bins.reduce((sum, bin) => sum + bin.observedPlayers, 0);
  const eligiblePlayerBins = result.bins.reduce((sum, bin) => sum + bin.eligiblePlayers, 0);
  const candidates = result.candidates.slice(0, 250);
  const measuredPressure = executionBursts(result.bins, EXECUTION_PRESSURE_CONFIG);
  const pressureCandidates = measuredPressure.candidates.slice(0, 100);
  return {
    method: result.method,
    scope: result.scope,
    resolutionMs: result.resolutionMs,
    durationMs: result.durationMs,
    eligiblePlayers: result.eligiblePlayers,
    selectedTargetCount: result.selectedTargetIndices?.length ?? null,
    unknownTargetClassifications: result.unknownTargetClassifications,
    fullFightPhase: result.fullFightPhase,
    duplicateAccounts: result.duplicateAccounts,
    unidentifiedPlayers: result.unidentifiedPlayers,
    unsupportedDuration: result.unsupportedDuration,
    unmeasuredTailMs: result.unmeasuredTailMs,
    coverage: {
      totalBins,
      knownBins,
      activityBins,
      quietBins,
      unknownBins: totalBins - knownBins,
      observedPlayerBins,
      eligiblePlayerBins,
      evidenceCoverage: eligiblePlayerBins > 0 ? observedPlayerBins / eligiblePlayerBins : null,
    },
    pressure: {
      method: measuredPressure.method,
      config: measuredPressure.config,
      candidates: pressureCandidates,
      omittedCandidates: Math.max(0, measuredPressure.candidates.length - pressureCandidates.length),
      excludedWindows: measuredPressure.excludedWindows,
      limitations: [
        ...measuredPressure.limitations,
        result.scope === 'recorded-enemy-players'
          ? 'Pressure is restricted to targets explicitly classified as enemy players in this report.'
          : 'Pressure includes every target represented by Damage1S, not only enemy players.',
      ],
    },
    candidates,
    omittedCandidates: Math.max(0, result.candidates.length - candidates.length),
    sourceRefs: result.scope === 'recorded-enemy-players'
      ? ['raw.players[].targetDamage1S', 'raw.targets[].enemyPlayer', 'raw.phases[0]']
      : ['raw.players[].damage1S[0]'],
    limitations: result.limitations,
  };
}
