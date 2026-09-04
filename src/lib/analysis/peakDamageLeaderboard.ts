import type { DpsGraphData } from "../../types/report";
import { peakOneSecondDamage } from "./burstDamage";

interface PeakDamageRecord {
  account: string;
  profession: string;
  damage: number;
  fight: string;
  startMs: number;
  endMs: number;
  fights: number;
}

export function buildPeakDamageLeaderboard(data?: DpsGraphData): Array<PeakDamageRecord & { rank: number }> {
  const best = new Map<string, PeakDamageRecord>();
  const seen = new Set<string>();
  for (const [fightIndex, fight] of (data?.fights ?? []).entries()) {
    for (const player of fight.players) {
      const id = JSON.stringify([fight.fightId, player.account]);
      if (seen.has(id)) continue;
      seen.add(id);
      const peak = peakOneSecondDamage({ points: player.points, durationMs: fight.durationMs, scope: "all-targets" });
      if (peak.status !== "available") continue;
      const previous = best.get(player.account);
      const fights = (previous?.fights ?? 0) + 1;
      if (!previous || peak.damage > previous.damage) {
        best.set(player.account, {
          account: player.account, profession: player.profession, damage: peak.damage,
          fight: `Fight ${fightIndex + 1}: ${fight.fightName}`, startMs: peak.startMs, endMs: peak.endMs, fights,
        });
      } else {
        previous.fights = fights;
      }
    }
  }
  let rank = 0;
  let lastDamage = -1;
  return [...best.values()].sort((a, b) => b.damage - a.damage || a.account.localeCompare(b.account))
    .map((record, index) => {
      if (record.damage !== lastDamage) rank = index + 1;
      lastDamage = record.damage;
      return { ...record, rank };
    });
}
