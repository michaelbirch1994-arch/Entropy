import { useMemo, useState } from "react";
import { useReport } from "../store/ReportContext";
import { profChip, relativeStackColor } from "../utils/format";
import Panel from "../components/ui/Panel";
import { Sparkles } from "lucide-react";
import type { BoonUptimeData } from "../types/report";
import { BUFF_TAB_ORDER } from "../lib/bridge-metrics/boonGeneration";

function uptimeColor(pct: number): string {
  if (pct >= 90) return "text-emerald-400";
  if (pct >= 50) return "text-amber-400";
  if (pct > 0) return "text-orange-400/80";
  return "text-slate-500";
}

// Tab order mirrors dps.report's Buffs sub-tabs. Shared with Buff Generation
// (BUFF_TAB_ORDER) so the two pages can never present these categories in a
// different order from each other.
const TAB_ORDER = BUFF_TAB_ORDER;

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

  // Precompute each stacking column's values once so relativeStackColor doesn't
  // rescan every row for every cell (O(players * columns) instead of squared).
  // Plain computation, not useMemo: this sits after the "no buff data" early
  // return above, so a hook here would change hook order between renders.
  const columnValuesById: Record<string, Array<number | undefined>> = {};
  for (const c of columns) {
    if (!c.stacking) continue;
    columnValuesById[c.id] = rows.map((r) => r.uptimes[c.id]);
  }

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
        subtitle="Duration buffs show % of the fight held; intensity-stacking buffs (Might, Stability, conditions) show average stacks, matching Elite Insights - weighted by time in combat across every fight joined"
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
                    const val = row.uptimes[c.id];
                    // Stacking buffs don't share a 0-100% scale (Might caps at 25,
                    // Stability is usually 0-3, most conditions have no practical
                    // cap), so they're colored relative to this column's own
                    // values rather than against the duration-buff thresholds.
                    const color = c.stacking
                      ? relativeStackColor(val, columnValuesById[c.id])
                      : uptimeColor(val ?? 0);
                    return (
                      <td key={c.id} className="text-center px-2 py-2.5 font-mono">
                        <span className={`font-bold ${color}`}>
                          {val === undefined ? "-" : c.stacking ? val.toFixed(1) : `${val.toFixed(0)}%`}
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