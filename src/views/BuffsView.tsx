import { useMemo, useState } from "react";
import { useReport } from "../store/ReportContext";
import { profChip } from "../utils/format";
import Panel from "../components/ui/Panel";
import { Sparkles } from "lucide-react";
import type { BoonUptimeData } from "../types/report";

function uptimeColor(pct: number): string {
  if (pct >= 90) return "text-emerald-400";
  if (pct >= 50) return "text-amber-400";
  if (pct > 0) return "text-orange-400/80";
  return "text-slate-500";
}

// Tab order mirrors dps.report's Buffs sub-tabs.
const TAB_ORDER = [
  "Boons",
  "Offensive Buffs",
  "Support Buffs",
  "Defensive Buffs",
  "Conditions",
  "Gear Buffs",
  "Debuffs",
  "Nourishments",
  "Enhancements",
  "Other Consumables",
  "Personal Buffs",
];

export default function BuffsView() {
  const { report } = useReport();
  const [tab, setTab] = useState<string>("Boons");
  if (!report) return null;
  const s = report.stats;

  const categories = s.buffCategoryUptimes ?? (s.boonUptimes ? { Boons: s.boonUptimes } : {});
  const tabs = useMemo(
    () => TAB_ORDER.filter((t) => categories[t] && categories[t].columns.length > 0 && categories[t].rows.length > 0),
    [categories],
  );
  const activeTab = tabs.includes(tab) ? tab : tabs[0];
  const data: BoonUptimeData | undefined = activeTab ? categories[activeTab] : undefined;

  if (!data || data.columns.length === 0 || data.rows.length === 0) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel
          title="Buffs"
          icon={<Sparkles className="w-3.5 h-3.5" />}
          empty={
            <div className="py-10 text-center text-sm text-slate-500">
              No buff uptime data available for this report.
            </div>
          }
        >
          {null}
        </Panel>
      </div>
    );
  }

  const { columns, rows } = data;

  return (
    <div className="space-y-5 animate-view pb-12">
      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border ${
                activeTab === t
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                  : "bg-white/[0.02] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/[0.12]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <Panel
        title={activeTab}
        subtitle="% of the fight each player held each buff - averaged across every fight they joined"
        icon={<Sparkles className="w-3.5 h-3.5" />}
        action={`${rows.length} players`}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-amber-500/10 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="text-left font-bold px-4 py-3 sticky left-0 bg-[#0a0e1f]/95">Player</th>
                <th className="text-left font-bold px-2 py-3">Class</th>
                {columns.map((c) => (
                  <th key={c.id} className="text-center font-bold px-2 py-3 min-w-[64px]" title={c.name}>
                    <div className="flex flex-col items-center gap-1">
                      {c.icon ? (
                        <img src={c.icon} alt={c.name} className="w-4 h-4 rounded-sm" loading="lazy" />
                      ) : (
                        <span className="w-4 h-4" />
                      )}
                      <span className="normal-case font-semibold text-slate-400">{c.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.account}
                  className={`border-b border-slate-800/40 hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}
                >
                  <td className="px-4 py-2.5 font-semibold text-slate-200 sticky left-0 bg-[#0a0e1f]/95 whitespace-nowrap">
                    {row.account}
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(row.profession)}`}>
                      {row.profession}
                    </span>
                  </td>
                  {columns.map((c) => {
                    const pct = row.uptimes[c.id];
                    return (
                      <td key={c.id} className="text-center px-2 py-2.5 font-mono">
                        <span className={`font-bold ${uptimeColor(pct ?? 0)}`}>
                          {pct === undefined ? "-" : `${pct.toFixed(0)}%`}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
