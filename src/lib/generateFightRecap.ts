// Turns computed report stats into a short, readable narrative recap -
// the "AI summary" feel without an actual model call (this is a static
// frontend with no LLM API wired up). Deterministic, template-based, but
// picks from enough variants and real numbers that it doesn't read canned.

import type { ReportStats } from "../types/report";
import { fmtCompact, fmtFixed, fmtNum } from "../utils/format";

export interface FightRecap {
  headline: string;
  paragraphs: string[];
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

export function generateFightRecap(s: ReportStats): FightRecap | null {
  if (!s || s.total === 0) return null;

  const winRate = s.total > 0 ? s.wins / s.total : 0;
  const kdrEdge = s.enemyKDR > 0 ? s.squadKDR / s.enemyKDR : s.squadKDR;
  const seed = Math.round((s.totalSquadKills + s.totalEnemyDeaths) * 7 + s.total * 13);

  // --- Headline ---
  let headline: string;
  if (s.total === 1) {
    headline = winRate === 1 ? "Clean win." : winRate === 0 ? "Tough fight." : "Mixed result.";
  } else if (winRate >= 0.75) {
    headline = pick(["Dominant night.", "Squad steamrolled.", "Near-perfect showing."], seed);
  } else if (winRate >= 0.5) {
    headline = pick(["Solid night overall.", "More wins than losses.", "Squad came out ahead."], seed);
  } else if (winRate > 0) {
    headline = pick(["A rough one.", "Mixed bag tonight.", "Some ground lost."], seed);
  } else {
    headline = "Tough night.";
  }

  const paragraphs: string[] = [];

  // --- Opening: fight count, squad size, W/L ---
  const fightWord = s.total === 1 ? "fight" : "fights";
  paragraphs.push(
    `${s.total} ${fightWord} logged, ${s.wins}W-${s.losses}L, averaging ${Math.round(s.avgSquadSize)} in squad against ` +
    `roughly ${Math.round(s.avgEnemies)} enemies. Squad KDR came in at ${fmtFixed(s.squadKDR, 2)} against an enemy KDR of ${fmtFixed(s.enemyKDR, 2)}` +
    (kdrEdge >= 1.5
      ? " - a clear kill-efficiency edge."
      : kdrEdge >= 1
      ? " - a modest edge in trades."
      : " - the enemy came out ahead on trades.")
  );

  // --- Kills/downs summary ---
  paragraphs.push(
    `The squad put down ${fmtNum(s.totalEnemyDowns)} enemies and secured ${fmtNum(s.totalEnemyKills)} kills, while taking ` +
    `${fmtNum(s.totalSquadDowns)} downs and losing ${fmtNum(s.totalSquadDeaths)} of its own.`
  );

  // --- MVP shoutouts ---
  if (s.offensiveMvp?.account) {
    const reason = s.offensiveMvp.reason ? ` (${s.offensiveMvp.reason})` : "";
    paragraphs.push(
      `${s.offensiveMvp.account} led the offensive charts on ${s.offensiveMvp.profession}${reason}` +
      (s.defensiveMvp?.account && s.defensiveMvp.account !== s.offensiveMvp.account
        ? `, while ${s.defensiveMvp.account} anchored the defensive side on ${s.defensiveMvp.profession}.`
        : ".")
    );
  }

  // --- Standout per-second stat ---
  const candidates: { label: string; player: string; value: number }[] = [
    { label: "healing output", player: s.maxHealing?.player, value: s.maxHealing?.value ?? 0 },
    { label: "down contribution", player: s.maxDownContrib?.player, value: s.maxDownContrib?.value ?? 0 },
    { label: "boon stripping", player: s.maxStrips?.player, value: s.maxStrips?.value ?? 0 },
    { label: "crowd control", player: s.maxCC?.player, value: s.maxCC?.value ?? 0 },
  ].filter((c) => c.player && c.value > 0);

  if (candidates.length > 0) {
    const top = pick(candidates, seed + 3);
    paragraphs.push(`${top.player} put up standout ${top.label} numbers, totaling ${fmtCompact(top.value)} across the squad's engagements.`);
  }

  return { headline, paragraphs };
}
