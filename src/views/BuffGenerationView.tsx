import { useMemo, useState } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import { profChip } from "../utils/format";
import { getBoonMetricValue } from "../lib/bridge-metrics/boonGeneration";
import { Sparkles } from "lucide-react";

const CATEGORY_LABELS = {
  selfBuffs: "Self",
  groupBuffs: "Group",
  squadBuffs: "Squad",
} as const;

export default function BuffGenerationView() {
  const { report } = useReport();
  const tables = report?.stats.buffGeneration ?? [];
  const [boonId, setBoonId] = useState<string>("");

  const activeTable = useMemo(() => {
    if (boonId && tables.some((t) => t.id === boonId)) return tables.find((t) => t.id === boonId)!;
    return tables[0];
  }, [tables, boonId]);

  if (!report) return null;

  if (tables.length === 0) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel
          title="Buff Generation"
          icon={<Sparkles className="w-3.5 h-3.5" />}
          empty={
            <div className="py-10 text-center text-sm text-slate-500">
              No boon generation data available for this report.
              <p className="text-[11px] text-slate-500 mt-1">
                Only populated for reports built from raw dps.report / .zevtc imports. This shows who is actually
                generating a boon versus who is just standing near someone who is - distinct from the plain uptime
                tables under Buffs, which show what each player *had*, not what they *produced*.
              </p>
            </div>
          }
        >
          {null}
        </Panel>
      </div>
    );
  }

  const rows = [...activeTable.rows].sort(
    (a, b) => getBoonMetricValue(b, "squadBuffs", activeTable.stacking, "uptime") - getBoonMetricValue(a, "squadBuffs", activeTable.stacking, "uptime")
  );
  const unit = activeTable.stacking ? "avg stacks" : "%";

  return (
    <div className="space-y-5 animate-view pb-12">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={activeTable?.id ?? ""}
          onChange={(e) => setBoonId(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2"
        >
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <Panel
        title={`${activeTable.name} Generation`}
        subtitle={`Self vs. group vs. squad ${unit} contributed by each player - not just uptime, actual output`}
        icon={
          activeTable.icon ? (
            <img src={activeTable.icon} alt="" referrerPolicy="no-referrer" className="w-4 h-4 rounded-sm" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )
        }
        action={`${rows.length} players`}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-amber-500/10 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="text-left font-bold px-4 py-3 sticky left-0 bg-[#0a0e1f]/95">Player</th>
                <th className="text-left font-bold px-2 py-3">Class</th>
                {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((cat) => (
                  <th key={cat} className="text-center font-bold px-3 py-3">
                    {CATEGORY_LABELS[cat]}
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
                  {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((cat) => {
                    const value = getBoonMetricValue(row, cat, activeTable.stacking, "uptime");
                    return (
                      <td key={cat} className="text-center px-3 py-2.5 font-mono">
                        <span className={`font-bold ${value > 0 ? "text-emerald-400" : "text-slate-600"}`}>
                          {activeTable.stacking ? value.toFixed(2) : `${value.toFixed(0)}%`}
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
