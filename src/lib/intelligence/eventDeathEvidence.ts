import type { DeathRecapEntry } from '../../types/report';
import type { IntelligenceEventWindow } from './eventInspection';

export interface EventDeathEvidence {
  recap: DeathRecapEntry;
  /** True only when the recap account is one of the event's already-linked players. */
  linkedPlayer: boolean;
  /** Signed offset from the selected Intelligence event anchor. */
  offsetMs: number;
}

export interface BuildEventDeathEvidenceInput {
  deathRecaps: readonly DeathRecapEntry[];
  fightIndex: number;
  window: IntelligenceEventWindow;
  relatedPlayerKeys: readonly string[];
}

/**
 * Finds existing Death Recap packets that fall inside an Intelligence event's
 * already-defined review window. This is a navigation/evidence adapter only:
 * it does not reinterpret damage, invent a cause of death, or mutate the recap.
 */
export function buildEventDeathEvidence({
  deathRecaps,
  fightIndex,
  window,
  relatedPlayerKeys,
}: BuildEventDeathEvidenceInput): EventDeathEvidence[] {
  if (!Number.isFinite(fightIndex) || fightIndex < 0) return [];

  const linkedPlayers = new Set(relatedPlayerKeys.filter((key) => key.length > 0));

  return deathRecaps
    .filter((recap) => recap.fightIndex === fightIndex)
    .filter((recap) => Number.isFinite(recap.deathTimeMs))
    .filter((recap) => recap.deathTimeMs >= window.startTimestampMs && recap.deathTimeMs <= window.endTimestampMs)
    .map((recap) => ({
      recap,
      linkedPlayer: linkedPlayers.has(recap.account),
      offsetMs: recap.deathTimeMs - window.anchorTimestampMs,
    }))
    .sort((a, b) => a.recap.deathTimeMs - b.recap.deathTimeMs || a.recap.account.localeCompare(b.recap.account));
}
