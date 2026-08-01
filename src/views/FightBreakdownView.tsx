import { useState } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import { fmtCompact } from "../utils/format";
import { Swords, ExternalLink } from "lucide-react";

export default function FightBreakdownView() {
  const { report } = useReport();
  const [showAll, setShowAll] = useState(false);
  if (!report) return null;
  const s = report.stats;
  const fights = s.fightBreakdown;
  const shown = showAll ? fights : fights.slice(0, 12);

  return (
    <div className="space-y-5 animate-view pb-12">
      <Panel
        title="Fight Breakdown"
        icon={<Swords className="w-4 h-4" />}
        accent="text-blue-500"
        action={<span>{fights.length} FIGHTS</span>}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/40">
                <th className="p-2.5 font-medium">#</th>
                <th className="p-2.5 font-medium">Fight</th>
                <th className="p-2.5 font-medium">Map</th>
                <th className="p-2.5 font-medium">Duration</th>
                <th className="p-2.5 font-medium">Outcome</th>
                <th className="p-2.5 font-medium text-right">Squad</th>
                <th className="p-2.5 font-medium text-right">Enemies</th>
                <th className="p-2.5 font-medium text-right">Kills</th>
                <th className="p-2.5 font-medium text-right">Deaths</th>
                <th className="p-2.5 font-medium text-right">Out Dmg</th>
                <th className="p-2.5 font-medium text-right">In Dmg</th>
                <th className="p-2.5 font-medium text-right">Strips</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30 font-mono">
              {shown.map((f, i) => (
                <tr key={f.id} className="hover:bg-blue-950/20 transition-colors">
                  <td className="p-2.5 text-slate-500">{i + 1}</td>
                  <td className="p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-300 font-semibold">{f.label}</span>
                      {f.permalink && (
                        <a
                          href={f.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-500 hover:text-blue-400"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="p-2.5 text-slate-400">{f.mapName}</td>
                  <td className="p-2.5 text-slate-400">{f.duration}</td>
                  <td className={`p-2.5 font-bold ${f.isWin ? "text-emerald-400" : "text-rose-400"}`}>
                    {f.isWin ? "Win" : "Loss"}
                  </td>
                  <td className="p-2.5 text-right text-slate-300">{f.squadCount}</td>
                  <td className="p-2.5 text-right text-slate-300">{f.enemyCount}</td>
                  <td className="p-2.5 text-right text-emerald-400">{f.enemyDeaths}</td>
                  <td className="p-2.5 text-right text-rose-400">{f.alliesDead}</td>
                  <td className="p-2.5 text-right text-slate-300">{fmtCompact(f.totalOutgoingDamage)}</td>
                  <td className="p-2.5 text-right text-slate-400">{fmtCompact(f.totalIncomingDamage)}</td>
                  <td className="p-2.5 text-right text-slate-400">{f.totalOutgoingStrips}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {fights.length > 12 && (
          <div className="p-3 border-t border-slate-800/40 text-center">
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors"
            >
              {showAll ? "Show less" : `Show all ${fights.length} fights`}
            </button>
          </div>
        )}
      </Panel>

      {/* Damage per fight chart */}
      <Panel title="Damage Per Fight" icon={<Swords className="w-4 h-4" />} accent="text-orange-400">
        <div className="space-y-2">
          {(() => {
            const maxDmg = fights.reduce((m, x) => Math.max(m, x.totalOutgoingDamage), 1);
            return shown.map((f) => {
            const pct = (f.totalOutgoingDamage / maxDmg) * 100;
            return (
              <div key={f.id} className="flex items-center gap-3 text-[11px] font-mono">
                <span className="w-16 text-slate-500 flex-shrink-0">{f.label}</span>
                <div className="flex-1 h-5 bg-slate-800/40 rounded overflow-hidden relative">
                  <div
                    className={`h-full rounded transition-all duration-500 ${f.isWin ? "bg-gradient-to-r from-emerald-600 to-emerald-400" : "bg-gradient-to-r from-orange-600 to-orange-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-20 text-right text-slate-300 flex-shrink-0">{fmtCompact(f.totalOutgoingDamage)}</span>
              </div>
            );
          });
          })()}
        </div>
      </Panel>
    </div>
  );
}
