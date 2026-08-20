import { classifyDegree, OUT_OF_POSITION, type ParsedReport } from '../bridge-metrics/positioning';
import { eventIdentity, type CombatAgent, type CombatEvent, type CombatEventSet } from '../combat/CombatEvent';
import { resolveAgentIdentityKey, describeAgent } from '../combat/agentIdentity';
import type { CriticalEvent } from './types';

interface ReplayPlayer {
  name?: string;
  account?: string;
  profession?: string;
  notInSquad?: boolean;
  hasCommanderTag?: boolean;
  combatReplayData?: {
    positions?: Array<[number, number]>;
    start?: number;
  };
}

export interface SquadSeparationOptions {
  /** Distance from commander/tag, in the same game units used by positioning.ts. */
  distanceThreshold?: number;
  /** Minimum continuous separation duration required before surfacing an event. */
  minDurationMs?: number;
  /** Attach same-player down/death events that happen this close to the separation window. */
  downDeathLookaroundMs?: number;
  /** Distance within which this player is considered to have joined formation. */
  formationDistanceThreshold?: number;
  /** Continuous time near tag required before this player can be judged as separated. */
  formationMinDurationMs?: number;
}

const DEFAULT_DISTANCE_THRESHOLD = OUT_OF_POSITION;
const DEFAULT_MIN_DURATION_MS = 3000;
const DEFAULT_DOWN_DEATH_LOOKAROUND_MS = 3000;
const DEFAULT_FORMATION_DISTANCE_THRESHOLD = 600;
const DEFAULT_FORMATION_MIN_DURATION_MS = 1000;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const squadOf = (report: ParsedReport): ReplayPlayer[] =>
  ((report as any).details?.players ?? []).filter((p: ReplayPlayer) => !p?.notInSquad);

function agentOf(player: ReplayPlayer, playerIndex?: number): CombatAgent {
  return {
    name: player?.name ?? 'Unknown',
    account: player?.account ?? undefined,
    profession: player?.profession ?? undefined,
    kind: 'player',
    side: 'friendly',
    playerIndex,
  };
}

interface SeparationSample {
  timestampMs: number;
  distance: number;
}

/**
 * Detects squad members separated from commander/tag for a sustained window.
 *
 * Separation is only meaningful after the player has first established formation near
 * the commander. This suppresses replay-start/setup noise where a player begins far
 * from tag before the fight has actually formed, without imposing an arbitrary global
 * "ignore the first N seconds" window that could hide a legitimate early separation.
 * Formation is established independently per player and remains established for the
 * rest of the fight once proven.
 *
 * This deliberately does NOT normalize positioning into CombatEvents. Positioning is
 * continuous replay data, not discrete combat events, and CombatEvent.ts explicitly
 * keeps it in positioning.ts as the source of truth. This detector reads that source
 * directly and emits evidence-backed CriticalEvents only when full replay is present.
 *
 * On coarse/no replay logs it returns [] rather than treating missing replay as "no
 * separation happened" or inventing timing from aggregate distance stats.
 */
export function detectSquadSeparations(
  report: ParsedReport,
  fightId: string,
  downDeathEventSet?: CombatEventSet,
  options: SquadSeparationOptions = {},
): CriticalEvent[] {
  if (classifyDegree(report) !== 'full') return [];

  const distanceThreshold = options.distanceThreshold ?? DEFAULT_DISTANCE_THRESHOLD;
  const minDurationMs = options.minDurationMs ?? DEFAULT_MIN_DURATION_MS;
  const downDeathLookaroundMs = options.downDeathLookaroundMs ?? DEFAULT_DOWN_DEATH_LOOKAROUND_MS;
  const formationDistanceThreshold = options.formationDistanceThreshold ?? DEFAULT_FORMATION_DISTANCE_THRESHOLD;
  const formationMinDurationMs = options.formationMinDurationMs ?? DEFAULT_FORMATION_MIN_DURATION_MS;

  const meta = report.details?.combatReplayMetaData ?? {};
  const pollingRate = Number(meta.pollingRate ?? 0);
  const inchToPixel = Number(meta.inchToPixel ?? 0);
  if (pollingRate <= 0 || inchToPixel <= 0) return [];

  const squad = squadOf(report);
  const commander = squad.find((p) => p?.hasCommanderTag);
  const tagPositions = commander?.combatReplayData?.positions ?? [];
  if (!commander || tagPositions.length === 0) return [];

  const downDeathEvents = (downDeathEventSet?.events ?? []).filter(
    (e) => (e.category === 'down' || e.category === 'death') && e.timestampMs !== null,
  );

  const results: CriticalEvent[] = [];

  squad.forEach((player, playerIndex) => {
    if (player?.hasCommanderTag) return;

    const positions = player?.combatReplayData?.positions ?? [];
    if (!Array.isArray(positions) || positions.length === 0) return;

    const agent = agentOf(player, playerIndex);
    const playerKey = resolveAgentIdentityKey(agent);
    const playerStart = Number(player?.combatReplayData?.start ?? 0);
    const playerOffset = Math.floor(playerStart / pollingRate);
    let run: SeparationSample[] = [];
    let formationRunStartMs: number | null = null;
    let hasEstablishedFormation = false;

    const flushRun = () => {
      if (run.length === 0) return;

      const startMs = run[0].timestampMs;
      const lastMs = run[run.length - 1].timestampMs;
      const durationMs = lastMs - startMs + pollingRate;
      if (durationMs < minDurationMs) {
        run = [];
        return;
      }

      const peakDistance = Math.max(...run.map((s) => s.distance));
      const averageDistance = run.reduce((sum, s) => sum + s.distance, 0) / run.length;
      const relatedDownDeaths = downDeathEvents.filter((e) => {
        if (resolveAgentIdentityKey(e.source) !== playerKey) return false;
        const timestampMs = e.timestampMs as number;
        return timestampMs >= startMs - downDeathLookaroundMs && timestampMs <= lastMs + downDeathLookaroundMs;
      });

      const relatedSuffix =
        relatedDownDeaths.length > 0
          ? `, with ${relatedDownDeaths.length} linked down/death event${relatedDownDeaths.length === 1 ? '' : 's'}`
          : '';

      results.push({
        id: `squad-separation:${fightId}:${startMs}:${playerKey}`,
        timestampMs: startMs,
        fightId,
        category: 'positioning',
        kind: 'squad-separation',
        summary:
          `${describeAgent(agent)} was separated from commander for ${(durationMs / 1000).toFixed(1)}s ` +
          `(peak ${Math.round(peakDistance)}, avg ${Math.round(averageDistance)})${relatedSuffix}.`,
        relatedEvents: relatedDownDeaths.map((e) => eventIdentity(e)),
        relatedPlayers: [playerKey],
        confidence: 'high',
      });

      run = [];
    };

    for (let i = 0; i < positions.length; i++) {
      const tagIndex = clamp(i + playerOffset, 0, tagPositions.length - 1);
      const [px, py] = positions[i];
      const [tx, ty] = tagPositions[tagIndex];
      const distance = Math.hypot(px - tx, py - ty) / inchToPixel;
      const timestampMs = (i + playerOffset) * pollingRate;

      if (!hasEstablishedFormation) {
        if (distance <= formationDistanceThreshold) {
          formationRunStartMs ??= timestampMs;
          const formationDurationMs = timestampMs - formationRunStartMs + pollingRate;
          if (formationDurationMs >= formationMinDurationMs) {
            hasEstablishedFormation = true;
          }
        } else {
          formationRunStartMs = null;
        }

        // Never let pre-formation distance become a separation run. Once formation is
        // established on this sample, separation can only begin on a later sample.
        run = [];
        continue;
      }

      if (distance >= distanceThreshold) {
        run.push({ timestampMs, distance });
      } else {
        flushRun();
      }
    }

    flushRun();
  });

  return results.sort((a, b) => a.timestampMs - b.timestampMs);
}
