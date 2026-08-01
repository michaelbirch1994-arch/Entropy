import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import StatCard from "../components/ui/StatCard";
import { fmtNum, fmtDur, profChip, profStyle } from "../utils/format";
import { Users, Clock, Heart, Eye } from "lucide-react";

export default function RosterView() {
  const { report } = useReport();
  if (!report) return null;
  const s = report.stats;
  const attendance = s.attendanceData;

  const totalCombatMs = attendance.reduce((a, p) => a + p.combatTimeMs, 0);
  const avgCombatMs = attendance.length ? totalCombatMs / attendance.length : 0;
  const fullAtt = attendance.filter((p) => p.combatTimeMs / p.squadTimeMs > 0.9).length;

  return (
    <div className="space-y-5 animate-view pb-12">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Roster Size" value={fmtNum(attendance.length)} icon={<Users className="w-3.5 h-3.5 text-sky-400" />} accent="text-sky-400" />
        <StatCard label="Avg Combat Time" value={fmtDur(avgCombatMs)} icon={<Clock className="w-3.5 h-3.5 text-emerald-400" />} accent="text-emerald-400" />
        <StatCard label="Full Attendance" value={fullAtt} icon={<Heart className="w-3.5 h-3.5 text-rose-400" />} accent="text-rose-400" sub=">90% combat uptime" />
        <StatCard label="Total Fights" value={fmtNum(s.total)} icon={<Eye className="w-3.5 h-3.5 text-cyan-400" />} accent="text-cyan-400" />
      </div>

      {/* Roster table */}
      <Panel title="Roster Intel" icon={<Users className="w-4 h-4" />} accent="text-sky-400" action={`${attendance.length} PLAYERS`} bodyClassName="p-0">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/50">
                <th className="p-2.5">Player</th>
                <th className="p-2.5">Characters</th>
                <th className="p-2.5">Classes Played</th>
                <th className="p-2.5 text-right">Combat Time</th>
                <th className="p-2.5 text-right">Squad Time</th>
                <th className="p-2.5 w-32">Uptime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30 font-mono">
              {[...attendance]
                .sort((a, b) => b.combatTimeMs - a.combatTimeMs)
                .map((p) => {
                  const uptime = p.squadTimeMs > 0 ? (p.combatTimeMs / p.squadTimeMs) * 100 : 0;
                  const mainProf = p.classTimes[0]?.profession ?? "Unknown";
                  const st = profStyle(mainProf);
                  return (
                    <tr key={p.account} className="hover:bg-blue-950/20 transition-colors">
                      <td className="p-2.5 text-slate-200 font-semibold whitespace-nowrap">{p.account}</td>
                      <td className="p-2.5 text-slate-400">{p.characterNames.join(", ") || "—"}</td>
                      <td className="p-2.5">
                        <div className="flex flex-wrap gap-1">
                          {p.classTimes.slice(0, 3).map((c) => (
                            <span key={c.profession} className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(c.profession)}`}>
                              {c.profession}
                            </span>
                          ))}
                          {p.classTimes.length > 3 && (
                            <span className="text-[10px] text-slate-500">+{p.classTimes.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5 text-right text-slate-300">{fmtDur(p.combatTimeMs)}</td>
                      <td className="p-2.5 text-right text-slate-500">{fmtDur(p.squadTimeMs)}</td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 bg-slate-800/60 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${st.dot}`}
                              style={{ width: `${uptime}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-bold w-10 text-right ${uptime > 80 ? "text-emerald-400" : uptime > 50 ? "text-amber-400" : "text-rose-400"}`}>
                            {uptime.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
