import { useMemo } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import { profChip } from "../utils/format";
import { getBoonMetricValue, getBoonWastedValue, getBoonOverstackValue } from "../lib/bridge-metrics/boonGeneration";
import { Sparkles } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE } from "../utils/chartTheme";

const CATEGORY_LABELS = {
  selfBuffs: "Self",
  groupBuffs: "Group",
  squadBuffs: "Squad",
} as const;

const BAR_COLORS = [CHART_COLORS.amber, CHART_COLORS.sky, CHART_COLORS.rose, CHART_COLORS.emerald, CHART_COLORS.teal, CHART_COLORS.orange, CHART_COLORS.cyan, CHART_COLORS.blue, CHART_COLORS.red];

// Custom XAxis tick that draws the boon's own icon instead of/alongside its
// name, so the summary chart reads at a glance instead of requiring the
// dropdown-per-boon flow this replaced.
function BoonIconTick(props: any) {
  const { x, y, payload, icons } = props;
  const icon = icons?.[payload.value];
  return (
    <g transform={`translate(${x},${y})`}>
      {icon ? (
        <image href={icon} x={-10} y={6} width={20} height={20} />
      ) : (
        <text x={0} y={16} textAnchor="middle" fill="#64748b" fontSize={9}>
          {String(payload.value).slice(0, 4)}
        </text>
      )}
    </g>
  );
}

export default function BuffGenerationView() {
  const { report } = useReport();
  const tables = report?.stats.buffGeneration ?? [];

  // One bar per boon: squad-average output (avg stacks for stacking boons,
  // avg uptime% for pulse boons) across everyone who generated any of it -
  // gives an immediate "what is my squad actually producing" read instead
  // of clicking through boons one at a time.
  const chartData = useMemo(() => {
    return tables
      .map((t) => {
        const contributors = t.rows.filter((r) => getBoonMetricValue(r, "squadBuffs", t.stacking, "uptime") > 0);
        if (contributors.length === 0) return null;
        const avg = contributors.reduce((sum, r) => sum + getBoonMetricValue(r, "squadBuffs", t.stacking, "uptime"), 0) / contributors.length;
        return { id: t.id, name: t.name, icon: t.icon, stacking: t.stacking, value: Math.round(avg * 100) / 100 };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) => b.value - a.value);
  }, [tables]);

  const iconsById = useMemo(() => Object.fromEntries(chartData.map((d) => [d.name, d.icon])), [chartData]);

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

  return (
    <div className="space-y-5 animate-view pb-12">
      <Panel
        title="Squad Boon Output"
        subtitle="Average squad-facing output per boon (avg stacks for stacking boons, avg uptime% for pulse boons) - hover a bar for units"
        icon={<Sparkles className="w-3.5 h-3.5" />}
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="name"
                interval={0}
                height={40}
                tick={(props) => <BoonIconTick {...props} icons={iconsById} />}
                stroke="#334155"
              />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" width={40} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                formatter={(v, _n, item) => [
                  item?.payload?.stacking ? `${v} avg stacks` : `${v}%`,
                  item?.payload?.name,
                ]}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={d.id} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {tables.map((table) => {
        const rows = [...table.rows].sort(
          (a, b) => getBoonMetricValue(b, "squadBuffs", table.stacking, "uptime") - getBoonMetricValue(a, "squadBuffs", table.stacking, "uptime")
        );
        const unit = table.stacking ? "avg stacks" : "%";

        return (
          <Panel
            key={table.id}
            title={`${table.name} Generation`}
            subtitle={`Self vs. group vs. squad ${unit} contributed by each player, plus how much of that squad output was reapplied before it was needed (Reapplied) or discarded past the stack/effect cap (Overcapped)`}
            icon={
              table.icon ? (
                <img src={table.icon} alt="" referrerPolicy="no-referrer" className="w-4 h-4 rounded-sm" />
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
                    <th className="text-center font-bold px-3 py-3 text-amber-500/70" title="Squad-facing generation that was reapplied before the buff needed refreshing - redundant, but not necessarily harmful">
                      Reapplied
                    </th>
                    <th className="text-center font-bold px-3 py-3 text-rose-500/70" title="Squad-facing generation that was discarded because the target was already past this buff's stack/effect cap">
                      Overcapped
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const wasted = getBoonWastedValue(row, "squadBuffs", table.stacking);
                    const overstack = getBoonOverstackValue(row, "squadBuffs", table.stacking);
                    return (
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
                          const value = getBoonMetricValue(row, cat, table.stacking, "uptime");
                          return (
                            <td key={cat} className="text-center px-3 py-2.5 font-mono">
                              <span className={`font-bold ${value > 0 ? "text-emerald-400" : "text-slate-600"}`}>
                                {table.stacking ? value.toFixed(2) : `${value.toFixed(0)}%`}
                              </span>
                            </td>
                          );
                        })}
                        <td className="text-center px-3 py-2.5 font-mono">
                          <span className={wasted > 0 ? "text-amber-400/80" : "text-slate-700"}>
                            {table.stacking ? wasted.toFixed(2) : `${wasted.toFixed(0)}%`}
                          </span>
                        </td>
                        <td className="text-center px-3 py-2.5 font-mono">
                          <span className={overstack > 0 ? "text-rose-400/80" : "text-slate-700"}>
                            {table.stacking ? overstack.toFixed(2) : `${overstack.toFixed(0)}%`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
