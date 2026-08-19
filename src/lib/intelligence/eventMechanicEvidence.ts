import type { ReplayFightEntry } from "../../types/report";
import type { IntelligenceEventWindow } from "./eventInspection";

export type EventMechanicRelation = "before" | "anchor" | "after";

export interface EventMechanicEvidence {
  fightId: string;
  fightName: string;
  timestampMs: number;
  offsetMs: number;
  relation: EventMechanicRelation;
  name: string;
  severity: string;
  actor: string;
  account?: string;
  linkedPlayer: boolean;
}

function relationForOffset(offsetMs: number): EventMechanicRelation {
  if (offsetMs < 0) return "before";
  if (offsetMs > 0) return "after";
  return "anchor";
}

export function buildEventMechanicEvidence({
  replayFights,
  fightId,
  window,
  relatedPlayerKeys = [],
}: {
  replayFights: ReplayFightEntry[];
  fightId: string;
  window: IntelligenceEventWindow;
  relatedPlayerKeys?: string[];
}): EventMechanicEvidence[] {
  const fight = replayFights.find((candidate) => candidate.fightId === fightId);
  if (!fight) return [];

  const linkedKeys = new Set(relatedPlayerKeys);

  return (fight.data.mechanics ?? [])
    .filter((mechanic) => mechanic.t >= window.startTimestampMs && mechanic.t <= window.endTimestampMs)
    .map((mechanic) => {
      const offsetMs = mechanic.t - window.anchorTimestampMs;
      return {
        fightId: fight.fightId,
        fightName: fight.fightName,
        timestampMs: mechanic.t,
        offsetMs,
        relation: relationForOffset(offsetMs),
        name: mechanic.name,
        severity: mechanic.severity,
        actor: mechanic.actor,
        account: mechanic.account,
        linkedPlayer: !!mechanic.account && linkedKeys.has(mechanic.account),
      };
    })
    .sort((a, b) => a.timestampMs - b.timestampMs || a.name.localeCompare(b.name));
}
