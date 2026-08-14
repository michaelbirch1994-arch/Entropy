import type { LeaderboardEntry } from "../../types/report";
import { fmtCompact, fmtNum, profChip, profStyle } from "../../utils/format";
import ClassIcon from "./ClassIcon";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  metricLabel: string;
  compact?: boolean;
  unit?: string;
}

export default function LeaderboardTable({ entries, metricLabel, compact = false, unit }: LeaderboardTableProps) {
  const max = entries.length ? entries[0].value : 1;
  return (
    <div className="theme-table-shell overflow-x-auto">
      <table className="theme-data-table w-full text-left border-collapse text-xs">
        <thead>
          <tr className="theme-table-head text-[10px] uppercase font-bold tracking-wider">
            <th className="px-2 py-2 font-medium w-10">#</th>
            <th className="px-2 py-2 font-medium">Player</th>
            <th className="px-2 py-2 font-medium">Class</th>
            <th className="px-2 py-2 font-medium text-right">{metricLabel}</th>
            {!compact && <th className="px-2 py-2 font-medium text-right">Logs</th>}
            {!compact && <th className="px-2 py-2 font-medium w-32">Share</th>}
          </tr>
        </thead>
        <tbody className="font-mono">
          {entries.map((e) => {
            const s = profStyle(e.profession);
            const pct = max > 0 ? (e.value / max) * 100 : 0;
            return (
              <tr key={e.account} className="theme-table-row transition-colors">
                <td className={`px-2 py-2 font-bold ${e.rank <= 3 ? "text-theme-accent-strong" : "text-theme-muted"}`}>{e.rank}</td>
                <td className="px-2 py-2 text-theme-text font-semibold whitespace-nowrap">{e.account}</td>
                <td className="px-2 py-2">
                  <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(e.profession)}`}>
                    <ClassIcon name={e.profession} size="xs" />
                    {e.profession}
                  </span>
                </td>
                <td className="px-2 py-2 text-right text-theme-text font-bold whitespace-nowrap">
                  {compact ? fmtCompact(e.value) : fmtNum(e.value)}
                  {unit && <span className="text-theme-muted ml-0.5 text-[10px]">{unit}</span>}
                </td>
                {!compact && <td className="px-2 py-2 text-right text-theme-muted">{e.count}</td>}
                {!compact && (
                  <td className="px-2 py-2">
                    <div className="theme-progress-track h-1.5 w-full rounded-full overflow-hidden">
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
