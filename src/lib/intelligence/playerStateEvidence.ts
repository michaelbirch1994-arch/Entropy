import type { RawFightLog } from "../../types/rawFight";
import { inspectReplayPlayer, type ReplayInspectionEffect } from "../replayInspection";

export type PlayerControlEvidenceStatus =
  | "known-control-effect"
  | "no-condition-control-observed"
  | "timestamp-state-unavailable";

export interface IntelligencePlayerStateEvidence {
  account: string;
  name: string;
  profession: string;
  timestampMs: number;
  boons: ReplayInspectionEffect[];
  conditions: ReplayInspectionEffect[];
  hasTimestampedBuffState: boolean;
  controlEffects: string[];
  controlStatus: PlayerControlEvidenceStatus;
}

/**
 * Adapts Entropy's existing replay inspection into Intelligence evidence.
 *
 * This deliberately does not infer hard-CC absence. EI buff-state timelines can
 * prove condition-backed control effects such as Fear, Taunt, or Immobilize when
 * present, but hosted JSON does not guarantee a complete timestamped stun/daze/
 * launch/etc timeline. Therefore an empty controlEffects array means only that no
 * condition-backed control effect was observed in the available state timeline.
 */
export function buildIntelligencePlayerStateEvidence({
  log,
  account,
  timestampMs,
}: {
  log: RawFightLog;
  account: string;
  timestampMs: number;
}): IntelligencePlayerStateEvidence | null {
  const inspection = inspectReplayPlayer(log, account, timestampMs);
  if (!inspection) return null;

  const controlStatus: PlayerControlEvidenceStatus = !inspection.hasTimestampedBuffState
    ? "timestamp-state-unavailable"
    : inspection.controlEffects.length > 0
      ? "known-control-effect"
      : "no-condition-control-observed";

  return {
    account: inspection.account,
    name: inspection.name,
    profession: inspection.profession,
    timestampMs,
    boons: inspection.boons,
    conditions: inspection.conditions,
    hasTimestampedBuffState: inspection.hasTimestampedBuffState,
    controlEffects: inspection.controlEffects,
    controlStatus,
  };
}
