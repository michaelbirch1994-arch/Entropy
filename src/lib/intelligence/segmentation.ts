import { eventIdentity, type CombatEvent } from '../combat/CombatEvent';
import { resolveAgentIdentityKey } from '../combat/agentIdentity';
import { timestamped } from '../combat/timeWindow';
import type { CriticalEvent, Evidence } from './types';
import {
  createEngagementSegment,
  DEFAULT_ENGAGEMENT_SEGMENTATION_CONFIG,
  type EngagementBoundary,
  type EngagementSegmentationConfig,
  type EngagementSegment,
} from './engagementTypes';

export interface EngagementSegmentationInput {
  fightId: string;
  combatEvents: CombatEvent[];
  criticalEvents: CriticalEvent[];
  config?: Partial<EngagementSegmentationConfig>;
}

interface TimelineSignal {
  timestampMs: number;
  combatEvent?: CombatEvent;
  criticalEvent?: CriticalEvent;
}

function mergedConfig(config?: Partial<EngagementSegmentationConfig>): EngagementSegmentationConfig {
  return { ...DEFAULT_ENGAGEMENT_SEGMENTATION_CONFIG, ...config };
}

function signalTime(signal: TimelineSignal): number {
  return signal.timestampMs;
}

function signalsOf(input: EngagementSegmentationInput): TimelineSignal[] {
  const combatSignals = timestamped(input.combatEvents).map((combatEvent) => ({
    timestampMs: combatEvent.timestampMs,
    combatEvent,
  }));

  const criticalSignals = input.criticalEvents.map((criticalEvent) => ({
    timestampMs: criticalEvent.timestampMs,
    criticalEvent,
  }));

  return [...combatSignals, ...criticalSignals].sort((a, b) => a.timestampMs - b.timestampMs);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function confidenceOf(signals: TimelineSignal[]): EngagementSegment['confidence'] {
  const rank = { high: 3, medium: 2, low: 1, none: 0 } as const;
  let worst: EngagementSegment['confidence'] = 'high';

  for (const signal of signals) {
    const confidence = signal.combatEvent?.confidence ?? signal.criticalEvent?.confidence ?? 'high';
    if (rank[confidence] < rank[worst]) worst = confidence;
  }

  return signals.length === 0 ? 'none' : worst;
}

function participantKeysOf(signals: TimelineSignal[]): string[] {
  const keys: string[] = [];

  for (const signal of signals) {
    if (signal.combatEvent) {
      keys.push(resolveAgentIdentityKey(signal.combatEvent.source));
      if (signal.combatEvent.target) keys.push(resolveAgentIdentityKey(signal.combatEvent.target));
    }
    if (signal.criticalEvent?.relatedPlayers) keys.push(...signal.criticalEvent.relatedPlayers);
  }

  return unique(keys).filter((key) => key !== 'unknown:-');
}

function combatIdsOf(signals: TimelineSignal[]): string[] {
  return unique(signals.flatMap((signal) => (signal.combatEvent ? [eventIdentity(signal.combatEvent)] : [])));
}

function criticalIdsOf(signals: TimelineSignal[]): string[] {
  return unique(signals.flatMap((signal) => (signal.criticalEvent ? [signal.criticalEvent.id] : [])));
}

function downCount(signals: TimelineSignal[]): number {
  return signals.filter((signal) => signal.combatEvent?.category === 'down').length;
}

function deathCount(signals: TimelineSignal[]): number {
  return signals.filter((signal) => signal.combatEvent?.category === 'death').length;
}

function boundary(timestampMs: number, reason: EngagementBoundary['reason'], evidence: Evidence[]): EngagementBoundary {
  return { timestampMs, reason, evidence };
}

function buildSegment(fightId: string, index: number, signals: TimelineSignal[]): EngagementSegment {
  const startMs = signals[0].timestampMs;
  const endMs = signals[signals.length - 1].timestampMs;
  const criticalEventIds = criticalIdsOf(signals);
  const combatEventIds = combatIdsOf(signals);
  const downs = downCount(signals);
  const deaths = deathCount(signals);

  const evidence: Evidence[] = [
    {
      statement: `${signals.length} timestamped signal${signals.length === 1 ? '' : 's'} grouped into this engagement.`,
      metrics: { signalCount: signals.length, startMs, endMs },
      relatedEvents: combatEventIds,
      relatedPlayers: participantKeysOf(signals),
    },
  ];

  if (criticalEventIds.length > 0) {
    evidence.push({
      statement: `${criticalEventIds.length} critical event${criticalEventIds.length === 1 ? '' : 's'} occurred inside this engagement.`,
      metrics: { criticalEventCount: criticalEventIds.length },
    });
  }

  const state: EngagementSegment['state'] = deaths > 0 && deaths >= Math.max(1, downs) ? 'wipe' : 'active';

  return createEngagementSegment({
    id: `engagement:${fightId}:${index}:${startMs}-${endMs}`,
    fightId,
    index,
    start: boundary(startMs, index === 0 ? 'fight-boundary' : 'combat-activity-start', [evidence[0]]),
    end: boundary(endMs, 'combat-activity-end', [evidence[0]]),
    durationMs: Math.max(0, endMs - startMs),
    state,
    confidence: confidenceOf(signals),
    criticalEventIds,
    combatEventIds,
    participantKeys: participantKeysOf(signals),
    downs,
    deaths,
    evidence,
  });
}

function shouldMergeShortSegment(segment: EngagementSegment, config: EngagementSegmentationConfig): boolean {
  return segment.durationMs < config.minimumEngagementMs && segment.criticalEventIds.length === 0;
}

function mergeSegments(fightId: string, segments: EngagementSegment[], config: EngagementSegmentationConfig): EngagementSegment[] {
  const merged: EngagementSegment[] = [];

  for (const segment of segments) {
    const previous = merged[merged.length - 1];
    const gap = previous ? segment.start.timestampMs - previous.end.timestampMs : Infinity;

    if (previous && (gap <= config.mergeGapMs || shouldMergeShortSegment(segment, config))) {
      const evidence: Evidence[] = [
        ...previous.evidence,
        ...segment.evidence,
        {
          statement: 'Adjacent engagement fragments were merged because the gap was short or the later fragment lacked critical-event evidence.',
          metrics: { gapMs: gap },
        },
      ];

      merged[merged.length - 1] = createEngagementSegment({
        ...previous,
        id: `engagement:${fightId}:${previous.index}:${previous.start.timestampMs}-${segment.end.timestampMs}`,
        end: segment.end,
        durationMs: segment.end.timestampMs - previous.start.timestampMs,
        state: segment.state === 'wipe' || previous.state === 'wipe' ? 'wipe' : 'active',
        confidence: confidenceOfConfidencePair(previous.confidence, segment.confidence),
        criticalEventIds: unique([...previous.criticalEventIds, ...segment.criticalEventIds]),
        combatEventIds: unique([...previous.combatEventIds, ...segment.combatEventIds]),
        participantKeys: unique([...previous.participantKeys, ...segment.participantKeys]),
        downs: previous.downs + segment.downs,
        deaths: previous.deaths + segment.deaths,
        evidence,
      });
    } else {
      merged.push({ ...segment, index: merged.length });
    }
  }

  return merged.map((segment, index) => ({ ...segment, index }));
}

function confidenceOfConfidencePair(
  a: EngagementSegment['confidence'],
  b: EngagementSegment['confidence'],
): EngagementSegment['confidence'] {
  const rank = { high: 3, medium: 2, low: 1, none: 0 } as const;
  return rank[a] <= rank[b] ? a : b;
}

/**
 * Conservative deterministic engagement segmentation.
 *
 * It only groups already timestamped CombatEvents and CriticalEvents. It does
 * not infer enemy intent, decide why a fight was won/lost, or produce prose
 * findings. Those belong to the later Finding layer.
 */
export function segmentEngagements(input: EngagementSegmentationInput): EngagementSegment[] {
  const config = mergedConfig(input.config);
  const signals = signalsOf(input);
  if (signals.length === 0) return [];

  const rawSegments: TimelineSignal[][] = [];
  let current: TimelineSignal[] = [signals[0]];

  for (let i = 1; i < signals.length; i++) {
    const previous = current[current.length - 1];
    const signal = signals[i];
    const gap = signalTime(signal) - signalTime(previous);

    if (gap >= config.inactivityGapMs) {
      rawSegments.push(current);
      current = [signal];
    } else {
      current.push(signal);
    }
  }
  rawSegments.push(current);

  const segments = rawSegments.map((segmentSignals, index) => buildSegment(input.fightId, index, segmentSignals));
  return mergeSegments(input.fightId, segments, config);
}

export function summarizeEngagement(segment: EngagementSegment): string {
  return `Engagement ${segment.index + 1}: ${(segment.durationMs / 1000).toFixed(1)}s, ${segment.criticalEventIds.length} critical events, ${segment.downs} downs, ${segment.deaths} deaths.`;
}
