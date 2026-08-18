/**
 * Entropy v2.3 engagement segmentation types.
 *
 * This file is structure-only. It defines the shape needed to group already
 * detected CombatEvents/CriticalEvents into meaningful WvW engagements, but it
 * does not decide the final segmentation algorithm or produce conclusions.
 *
 * Scope rule:
 * - Segment boundaries must be evidence-backed.
 * - Missing timing/positioning coverage must degrade confidence, not become 0.
 * - 0-100 intelligence scores remain out of scope for v2.3's first slice.
 */

import type { AttributionConfidence } from '../combat/CombatEvent';
import type { Evidence, CriticalEvent } from './types';

export type EngagementSegmentState =
  | 'active'
  | 'regroup'
  | 'disengage'
  | 'wipe'
  | 'unknown';

export type EngagementBoundaryReason =
  | 'combat-activity-start'
  | 'combat-activity-end'
  | 'critical-event-cluster'
  | 'inactivity-gap'
  | 'fight-boundary'
  | 'manual-or-derived';

export interface EngagementBoundary {
  timestampMs: number;
  reason: EngagementBoundaryReason;
  evidence: Evidence[];
}

export interface EngagementSegmentationConfig {
  /** A quiet period at least this long may split two engagements. */
  inactivityGapMs: number;
  /** Very short segments below this duration should be merged unless backed by critical events. */
  minimumEngagementMs: number;
  /** Adjacent segments closer than this may be merged when evidence is weak. */
  mergeGapMs: number;
}

export const DEFAULT_ENGAGEMENT_SEGMENTATION_CONFIG: EngagementSegmentationConfig = {
  inactivityGapMs: 15000,
  minimumEngagementMs: 5000,
  mergeGapMs: 3000,
};

export interface EngagementSegment {
  id: string;
  fightId: string;
  index: number;
  start: EngagementBoundary;
  end: EngagementBoundary;
  durationMs: number;
  state: EngagementSegmentState;
  confidence: AttributionConfidence;

  /** CriticalEvent ids contained in this segment. */
  criticalEventIds: string[];
  /** CombatEvent eventIdentity() strings contained in this segment. */
  combatEventIds: string[];
  /** Stable player/account identity keys involved in this segment where known. */
  participantKeys: string[];

  downs: number;
  deaths: number;
  evidence: Evidence[];
  note?: string;
}

export interface EngagementSummary {
  segmentId: string;
  fightId: string;
  index: number;
  durationMs: number;
  criticalEvents: CriticalEvent[];
  downs: number;
  deaths: number;
  confidence: AttributionConfidence;
  evidence: Evidence[];
}

export function createEngagementSegment(input: EngagementSegment): EngagementSegment {
  return input;
}
