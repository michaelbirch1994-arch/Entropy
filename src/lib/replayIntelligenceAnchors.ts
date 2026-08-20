import type { ReplayFightEntry } from "../types/report";
import type { IntelligenceDashboard } from "./intelligence/intelligenceDashboard";

export interface ReplayIntelligenceAnchor {
  id: string;
  fightId: string;
  fightIndex: number;
  fightName: string;
  timestampMs: number;
  kind: string;
  category: string;
  summary: string;
  confidence: string;
  account?: string;
}

function normalizePlayerKey(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function resolveTrackedAccount(fight: ReplayFightEntry, relatedPlayers: string[] | undefined): string | undefined {
  if (!relatedPlayers?.length) return undefined;

  const players = fight.data.players ?? [];
  for (const relatedPlayer of relatedPlayers) {
    const key = normalizePlayerKey(relatedPlayer);
    if (!key) continue;

    const exactAccount = players.find((player) => normalizePlayerKey(player.account) === key);
    if (exactAccount) return exactAccount.account;

    const exactName = players.find((player) => normalizePlayerKey(player.name) === key);
    if (exactName) return exactName.account;
  }

  return undefined;
}

export function buildReplayIntelligenceAnchors(
  dashboard: IntelligenceDashboard | null | undefined,
  replayFights: ReplayFightEntry[] | null | undefined,
): ReplayIntelligenceAnchor[] {
  if (!dashboard || !replayFights?.length) return [];

  const fightIndexById = new Map(replayFights.map((fight, index) => [String(fight.fightId), index]));

  return dashboard.criticalEvents
    .map((event): ReplayIntelligenceAnchor | null => {
      const fightIndex = fightIndexById.get(String(event.fightId));
      if (fightIndex == null) return null;
      const fight = replayFights[fightIndex];
      if (!Number.isFinite(event.timestampMs) || event.timestampMs < 0 || event.timestampMs > fight.data.durationMs) return null;

      return {
        id: event.id,
        fightId: String(event.fightId),
        fightIndex,
        fightName: fight.fightName,
        timestampMs: event.timestampMs,
        kind: event.kind,
        category: event.category,
        summary: event.summary,
        confidence: event.confidence,
        account: resolveTrackedAccount(fight, event.relatedPlayers),
      };
    })
    .filter((anchor): anchor is ReplayIntelligenceAnchor => anchor != null)
    .sort((a, b) => a.fightIndex - b.fightIndex || a.timestampMs - b.timestampMs || a.id.localeCompare(b.id));
}
