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
  accounts: string[];
}

function normalizePlayerKey(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function resolveTrackedAccounts(fight: ReplayFightEntry, relatedPlayers: string[] | undefined): string[] {
  if (!relatedPlayers?.length) return [];

  const players = fight.data.players ?? [];
  const resolved: string[] = [];

  for (const relatedPlayer of relatedPlayers) {
    const key = normalizePlayerKey(relatedPlayer);
    if (!key) continue;

    const exactAccount = players.find((player) => normalizePlayerKey(player.account) === key);
    const exactName = exactAccount ? undefined : players.find((player) => normalizePlayerKey(player.name) === key);
    const account = exactAccount?.account ?? exactName?.account;
    if (account && !resolved.includes(account)) resolved.push(account);
  }

  return resolved;
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

      const accounts = resolveTrackedAccounts(fight, event.relatedPlayers);

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
        account: accounts[0],
        accounts,
      };
    })
    .filter((anchor): anchor is ReplayIntelligenceAnchor => anchor != null)
    .sort((a, b) => a.fightIndex - b.fightIndex || a.timestampMs - b.timestampMs || a.id.localeCompare(b.id));
}
