import type { GeneralPlayer, LeaderboardEntry } from "../../types/report";
import { getSampleReliability, sampleReliabilityClasses } from "../../lib/sampleReliability";
import { fmtCompact, fmtDur, fmtNum, profStyle } from "../../utils/format";
import ProfessionIdentity from "./ProfessionIdentity";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  metricLabel: string;
  compact?: boolean;
  unit?: string;
  totalFights?: number;
  generalPlayers?: GeneralPlayer[];
}

export default function LeaderboardTable({ entries, metricLabel, compact = false, unit, totalFights, generalPlayers = [] }: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <div className="theme-analytics-empty" role="status">
        <div className="theme-analytics-empty-label">No ranked data</div>
        <p className="theme-analytics-empty-copy">No players have qualifying {metricLabel.toLowerCase()} data for the current report selection.</p>
      </div>
    );
  }

  const max = entries[0].value;
  const generalByAccount = new Map(generalPlayers.map((player) => [player.account, player]));
  return (
    <div className="theme-table-shell overflow-x-auto" tabIndex={0} aria-label={`${metricLabel} leaderboard`}>
      <table className="theme-data-table w-full text-left border-collapse text-xs">
        <thead>
          <tr className="theme-table-head text-[10px] uppercase font-bold tracking-wider">
            <th scope="col" className="px-2 py-2 font-medium w-10">#</th>
            <th scope="col" className="px-2 py-2 font-medium">Player</th>
            <th scope="col" className="px-2 py-2 font-medium">Class</th>
            <th scope="col" className="px-2 py-2 font-medium text-right">{metricLabel}</th>
            {!compact && <th scope="col" className="px-2 py-2 font-medium text-right">Sample</th>}
            {!compact && <th scope="col" className="px-2 py-2 font-medium w-32">Share</th>}
          </tr>
        </thead>
        <tbody className="font-mono">
          {entries.map((e) => {
            const s = profStyle(e.profession);
            const pct = max > 0 ? (e.value / max) * 100 : 0;
            const general = generalByAccount.get(e.account);
            const fights = general?.logsJoined ?? e.count;
            const reportFights = Math.max(fights, totalFights ?? fights);
            const combatTimeMs = general?.squadActiveMs ?? general?.totalFightMs ?? 0;
            const reliability = getSampleReliability(fights, reportFights, combatTimeMs);
            return (
              <tr
                key={`${e.account}:${e.profession}`}
                className="theme-table-row transition-colors"
                data-rank={e.rank <= 3 ? e.rank : undefined}
              >
                <td className={`px-2 py-2 font-bold ${e.rank <= 3 ? "text-theme-accent-strong" : "text-theme-muted"}`}>{e.rank}</td>
                <td className="theme-table-player px-2 py-2 text-theme-text font-semibold whitespace-nowrap">{e.account}</td>
                <td className="px-2 py-2">
                  <ProfessionIdentity profession={e.profession} />
                </td>
                <td className="theme-table-value px-2 py-2 text-right text-theme-text font-bold whitespace-nowrap tabular-nums">
                  {compact ? fmtCompact(e.value) : fmtNum(e.value)}
                  {unit && <span className="text-theme-muted ml-0.5 text-[10px]">{unit}</span>}
                </td>
                {!compact && (
                  <td className="theme-table-sample px-2 py-2 text-right text-theme-muted" title={reliability.detail}>
                    <div className="whitespace-nowrap font-bold text-theme-text/80 tabular-nums">
                      {fights}/{reportFights}
                      <span className="ml-1 text-[9px] font-normal text-theme-muted">({Math.round(reliability.coverage * 100)}%)</span>
                    </div>
                    <div className="mt-1 flex items-center justify-end gap-1.5 whitespace-nowrap text-[9px]">
                      <span>{fmtDur(combatTimeMs)} active</span>
                      <span className={`rounded-full border px-1.5 py-0.5 font-bold ${sampleReliabilityClasses(reliability.level)}`}>
                        {reliability.level === "strong" ? "Strong" : reliability.level === "moderate" ? "Moderate" : "Low"}
                      </span>
                    </div>
                  </td>
                )}
                {!compact && (
                  <td className="theme-table-share px-2 py-2">
                    <div className="theme-progress-track h-1.5 w-full rounded-full overflow-hidden" aria-label={`${pct.toFixed(1)}% of the leading value`}>
                      <div
                        className={`theme-progress-fill h-full ${s.dot} rounded-full transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
