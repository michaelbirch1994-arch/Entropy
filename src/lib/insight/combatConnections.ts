import type { WvWReport } from '../../types/report';
import type { ReplayEffectTrack } from '../parseReplayData';
import { effectTimelineCoverageStatus } from '../parseReplayData';
import { normalizeEvidenceProvenance } from './provenance';

export interface CombatMoment { time: number; end?: number; label: string; kind: 'cast' | 'mechanic' | 'down' | 'death'; icon?: string; account?: string }
export interface CombatMomentBin { index: number; moments: CombatMoment[] }
export interface EffectSpan { start: number; end: number; value: number }

type ConnectionFight = { id: string; name: string; duration: number };

const fightCache = new WeakMap<WvWReport, ConnectionFight[]>();

/**
 * Preserve every event while bounding the number of interactive timeline marks.
 * EI timelines are generally second-resolution; denser source events remain
 * available in each bin and in the exact linked-window list.
 */
export function combatMomentBins(moments: CombatMoment[], durationMs: number, maximumBins = 120): CombatMomentBin[] {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || maximumBins < 1) return [];
  const binCount = Math.min(Math.floor(maximumBins), Math.max(48, Math.ceil(durationMs / 1000)));
  const bins = new Map<number, CombatMoment[]>();
  for (const moment of moments) {
    if (!Number.isFinite(moment.time) || moment.time < 0 || moment.time > durationMs) continue;
    const index = Math.min(binCount - 1, Math.floor(moment.time / durationMs * binCount));
    const bin = bins.get(index);
    if (bin) bin.push(moment);
    else bins.set(index, [moment]);
  }
  return [...bins.entries()].sort(([left], [right]) => left - right)
    .map(([index, entries]) => ({ index, moments: entries }));
}
export function effectSpans(effect: ReplayEffectTrack, duration: number): EffectSpan[] {
  const states = effect.states.filter(([t, value]) => Number.isFinite(t) && Number.isFinite(value))
    .map(([t, value]) => [t, value] as [number, number]).sort((a, b) => a[0] - b[0]);
  return states.flatMap(([start, value], i) => {
    const end = Math.min(duration, states[i + 1]?.[0] ?? duration);
    return end > Math.max(0, start) ? [{ start: Math.max(0, start), end, value }] : [];
  });
}

export function connectionFights(report: WvWReport) {
  const cached = fightCache.get(report);
  if (cached) return cached;
  const result = new Map<string, { id: string; name: string; duration: number }>();
  for (const f of [...(report.stats.dpsGraph?.fights ?? []), ...(report.stats.rotations?.fights ?? []), ...(report.stats.mechanics?.fights ?? [])]) {
    if (f.durationMs > 0) result.set(f.fightId, { id: f.fightId, name: f.fightName, duration: f.durationMs });
  }
  for (const f of report.stats.replayFights ?? []) {
    if (f.data.durationMs > 0) result.set(f.fightId, { id: f.fightId, name: f.fightName, duration: f.data.durationMs });
  }
  const fights = [...result.values()];
  fightCache.set(report, fights);
  return fights;
}

/** Join existing datasets by fight identity; never assume their array indices match. */
function calculateCombatConnections(report: WvWReport, fightId: string, account: string, squadEvents = false) {
  const s = report.stats;
  const fight = connectionFights(report).find(f => f.id === fightId);
  if (!fight) return null;
  const replay = s.replayFights?.find(f => f.fightId === fightId);
  const track = replay?.data.players.find(p => p.account === account);
  const graph = s.dpsGraph?.fights.find(f => f.fightId === fightId);
  const series = graph?.players.find(p => p.account === account);
  const peers = graph?.players.filter(p => p.profession === series?.profession && p.account !== account) ?? [];
  const rate = (points: number[], i: number) => {
    if (i === 0 || i >= points.length) return null;
    const from = Math.max(0, i - 5);
    const difference = points[i] - points[from];
    return Number.isFinite(difference) && difference >= 0 ? difference / (i - from) : null;
  };
  const output = Array.from({ length: Math.floor(fight.duration / 1000) + 1 }, (_, i) => {
    const values = peers.map(p => rate(p.points, i)).filter((v): v is number => v !== null);
    return { time: i * 1000, dps: series ? rate(series.points, i) : null,
      peers: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null, peerCount: values.length };
  });
  const rotationFight = s.rotations?.fights.find(f => f.fightId === fightId);
  const rotation = rotationFight?.players.find(p => p.account === account);
  const squadAccounts = new Set((s.offensePlayers ?? []).map(p => p.account));
  for (const p of replay?.data.players ?? []) { if (p.inSquad === false) squadAccounts.delete(p.account); else squadAccounts.add(p.account); }
  const included = (actor: string) => actor === account || (squadEvents && squadAccounts.has(actor));
  const moments: CombatMoment[] = (rotationFight?.players ?? []).filter(p => included(p.account)).flatMap(p => p.casts.map(c => ({ time: c.castTime, account: p.account, label: s.rotations?.skillMeta[c.skillId]?.name ?? `Skill ${c.skillId}`, icon: s.rotations?.skillMeta[c.skillId]?.icon, kind: 'cast' as const })));
  for (const p of replay?.data.players ?? []) {
    if (!included(p.account)) continue;
    for (const [time, end] of p.downIntervals ?? []) moments.push({ time, end, account: p.account, kind: 'down', label: 'Downstate' });
    for (const [time, end] of p.deadIntervals ?? []) moments.push({ time, end, account: p.account, kind: 'death', label: 'Dead' });
  }
  const mechanics = s.mechanics?.fights.find(f => f.fightId === fightId);
  for (const mechanic of mechanics?.mechanics ?? []) {
    for (const event of mechanic.events) {
      const actor = event.account ?? replay?.data.players.find(p => p.name === event.actor)?.account;
      if (actor && included(actor)) {
        moments.push({ time: event.time, account: actor, kind: 'mechanic', label: mechanic.def.fullName || mechanic.def.name });
      }
    }
  }
  if (!mechanics) for (const event of replay?.data.mechanics ?? []) {
    if (event.account && included(event.account)) moments.push({ time: event.t, account: event.account, kind: 'mechanic', label: event.name });
  }
  const includedCasts = moments.filter(moment => moment.kind === 'cast').length;
  const includedMechanics = moments.filter(moment => moment.kind === 'mechanic').length;
  const survivalIntervals = (replay?.data.players ?? []).filter(player => included(player.account))
    .reduce((count, player) => count + (player.downIntervals?.length ?? 0) + (player.deadIntervals?.length ?? 0), 0);
  const parserSource = 'https://github.com/baaron4/GW2-Elite-Insights-Parser';
  const effectTimelineStatus = effectTimelineCoverageStatus(track);
  const provenance = normalizeEvidenceProvenance([
    includedCasts > 0 && { id: 'rotation-casts', kind: 'recorded-event', label: 'Skill casts',
      detail: `${includedCasts} timestamped cast start${includedCasts === 1 ? '' : 's'} from the selected fight.`, source: parserSource },
    includedMechanics > 0 && { id: 'mechanic-events', kind: 'recorded-event', label: 'Mechanic events',
      detail: `${includedMechanics} parser-labelled event${includedMechanics === 1 ? '' : 's'} in the active scope.`, source: parserSource },
    survivalIntervals > 0 && { id: 'survival-intervals', kind: 'parser-derived-state', label: 'Down and death intervals',
      detail: `${survivalIntervals} interval${survivalIntervals === 1 ? '' : 's'} reconstructed by Elite Insights.`, source: parserSource },
    track && { id: 'effect-timelines', kind: 'parser-derived-state',
      label: effectTimelineStatus === 'available' ? 'Effect timelines available'
        : effectTimelineStatus === 'partial' ? 'Effect timelines partial'
          : effectTimelineStatus === 'legacy-unknown' ? 'Effect timelines legacy-unstamped' : 'Effect timelines unavailable',
      detail: effectTimelineStatus === 'available'
        ? `${track.effects.length} timestamped boon or condition track${track.effects.length === 1 ? '' : 's'} with RawTimelineArrays coverage.`
        : effectTimelineStatus === 'partial'
          ? `${track.effects.length} effect track${track.effects.length === 1 ? '' : 's'} persisted from partially supplied state arrays.`
          : effectTimelineStatus === 'legacy-unknown'
            ? `${track.effects.length} effect track${track.effects.length === 1 ? '' : 's'} persisted in a legacy report without a coverage stamp.`
            : 'Timestamped boon and condition state arrays were not supplied; absence cannot be interpreted as zero.', source: parserSource },
    Boolean(series?.points.length) && { id: 'damage-series', kind: 'parser-derived-state', label: 'Damage series',
      detail: `${series!.points.length} cumulative damage sample${series!.points.length === 1 ? '' : 's'} converted to a five-second rolling rate.`, source: parserSource },
    { id: 'temporal-join', kind: 'bounded-inference', label: 'Combat connection',
      detail: 'Events are joined by fight, player and timestamp. Temporal overlap does not establish causation.' },
  ]);
  return { fight, account, eventScope: squadEvents ? 'squad' as const : 'player' as const, fightIndex: s.fightBreakdown?.findIndex(f => f.id === fightId) ?? -1,
    output, hasDamage: Boolean(series?.points.length), peerProfession: series?.profession, peerCount: peers.length,
    effects: (track?.effects ?? []).map(e => ({ ...e, spans: effectSpans(e, fight.duration) })),
    moments: moments.filter(m => Number.isFinite(m.time) && m.time >= 0 && m.time <= fight.duration).sort((a, b) => a.time - b.time),
    provenance,
    coverage: { casts: Boolean(squadEvents ? rotationFight : rotation), survival: Boolean(squadEvents ? replay : track), mechanics: Boolean(mechanics || replay?.data.mechanics?.length),
      effects: effectTimelineStatus, healingTimeline: false },
    healing: s.healingPlayers?.find(p => p.account === account) ?? null,
  };
}

type CombatConnectionsModel = ReturnType<typeof calculateCombatConnections>;
const connectionCache = new WeakMap<WvWReport, Map<string, CombatConnectionsModel>>();

export function buildCombatConnections(report: WvWReport, fightId: string, account: string, squadEvents = false) {
  let reportCache = connectionCache.get(report);
  if (!reportCache) {
    reportCache = new Map();
    connectionCache.set(report, reportCache);
  }
  const cacheKey = `${fightId}\u0000${account}\u0000${squadEvents ? 'squad' : 'player'}`;
  if (reportCache.has(cacheKey)) return reportCache.get(cacheKey) ?? null;

  const model = calculateCombatConnections(report, fightId, account, squadEvents);
  reportCache.set(cacheKey, model);
  return model;
}

export function connectionWindow(model: NonNullable<ReturnType<typeof buildCombatConnections>>, center: number, radius: number) {
  const start = Math.max(0, center - radius), end = Math.min(model.fight.duration, center + radius);
  return { fightId: model.fight.id, selectedAccount: model.account, eventScope: model.eventScope, startMs: start, endMs: end,
    output: model.output.filter(p => p.time >= start && p.time <= end),
    events: model.moments.filter(m => m.time <= end && (m.end ?? m.time) >= start),
    effects: model.effects.map(e => ({ name: e.name, classification: e.classification,
      spans: e.spans.filter(s => s.start <= end && s.end > start).map(s => ({ ...s, start: Math.max(start, s.start), end: Math.min(end, s.end) })) })),
    limitations: ['Output is five-second rolling damage per second; cast timing is not damage attribution.', 'Profession peers may have different roles or builds.', 'Simultaneous events do not establish causation.', 'Healing has no timestamped series in this report schema.', 'Unrecorded intervals and effects are unknown.'] };
}
