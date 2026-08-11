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
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/50">
            <th className="px-2 py-2 font-medium w-10">#</th>
            <th className="px-2 py-2 font-medium">Player</th>
            <th className="px-2 py-2 font-medium">Class</th>
            <th className="px-2 py-2 font-medium text-right">{metricLabel}</th>
            {!compact && <th className="px-2 py-2 font-medium text-right">Logs</th>}
            {!compact && <th className="px-2 py-2 font-medium w-32">Share</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/30 font-mono">
          {entries.map((e) => {
            const s = profStyle(e.profession);
            const pct = max > 0 ? (e.value / max) * 100 : 0;
            return (
              <tr key={e.account} className="hover:bg-blue-950/20 transition-colors">
                <td className={`px-2 py-2 font-bold ${e.rank <= 3 ? "text-amber-400" : "text-slate-500"}`}>{e.rank}</td>
                <td className="px-2 py-2 text-slate-200 font-semibold whitespace-nowrap">{e.account}</td>
                <td className="px-2 py-2">
                  <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(e.profession)}`}>
                    <ClassIcon name={e.profession} size="xs" />
                    {e.profession}
                  </span>
                </td>
                <td className="px-2 py-2 text-right text-slate-100 font-bold whitespace-nowrap">
                  {compact ? fmtCompact(e.value) : fmtNum(e.value)}
                  {unit && <span className="text-slate-500 ml-0.5 text-[10px]">{unit}</span>}
                </td>
                {!compact && <td className="px-2 py-2 text-right text-slate-500">{e.count}</td>}
                {!compact && (
                  <td className="px-2 py-2">
                    <div className="h-1.5 w-full bg-slate-800/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${s.dot} rounded-full transition-all`}
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
