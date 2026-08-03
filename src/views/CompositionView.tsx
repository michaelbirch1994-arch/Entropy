import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import { profStyle, fmtNum } from "../utils/format";
import type { ClassSlice } from "../types/report";
import { Layers, Users, Scale } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TOOLTIP_STYLE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE } from "../utils/chartTheme";

export default function CompositionView() {
  const { report } = useReport();
  if (!report) return null;
  const s = report.stats;
  const squadTotal = s.squadClassData.reduce((a, c) => a + c.value, 0);
  const enemyTotal = s.enemyClassData.reduce((a, c) => a + c.value, 0);

  const squadChart = s.squadClassData
    .slice()
    .sort((a, b) => b.value - a.value)
    .map((c) => ({ name: c.name, count: c.value, fill: c.color }));

  return (
    <div className="space-y-5 animate-view pb-12">
      <Panel title="Squad Composition" icon={<Users className="w-4 h-4" />} accent="text-sky-400" action={`${squadTotal} total slots`}>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={squadChart} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                stroke="#334155"
                angle={-35}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" />
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
              <Bar dataKey="count" name="Slots" radius={[4, 4, 0, 0]} barSize={28}>
                {squadChart.map((c) => (
                  <Cell key={c.name} fill={c.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Squad vs. Enemy delta - raw enemy counts alone don't say anything actionable.
          Comparing each class against the squad's own count answers the question that
          actually matters in WvW: which classes is the enemy running more/fewer of than
          us, so you know what to expect (e.g. "they have 3x our necros - expect heavy
          corrupts") instead of just a bare list of numbers. */}
      <CompositionDeltaPanel squadData={s.squadClassData} squadTotal={squadTotal} enemyData={s.enemyClassData} enemyTotal={enemyTotal} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ClassDetailPanel title="Squad Classes" data={s.squadClassData} total={squadTotal} />
        <ClassDetailPanel
          title="Enemy Classes"
          data={s.enemyClassData}
          total={enemyTotal}
          accent="text-rose-400"
        />
      </div>
    </div>
  );
}

function CompositionDeltaPanel({
  squadData,
  squadTotal,
  enemyData,
  enemyTotal,
}: {
  squadData: ClassSlice[];
  squadTotal: number;
  enemyData: ClassSlice[];
  enemyTotal: number;
}) {
  const squadByName = new Map(squadData.map((c) => [c.name, c.value]));
  const enemyByName = new Map(enemyData.map((c) => [c.name, c.value]));
  const names = Array.from(new Set([...squadByName.keys(), ...enemyByName.keys()]));

  const rows = names
    .map((name) => {
      const squadCount = squadByName.get(name) || 0;
      const enemyCount = enemyByName.get(name) || 0;
      const squadPct = squadTotal > 0 ? (squadCount / squadTotal) * 100 : 0;
      const enemyPct = enemyTotal > 0 ? (enemyCount / enemyTotal) * 100 : 0;
      return { name, squadCount, enemyCount, deltaPct: enemyPct - squadPct };
    })
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));

  return (
    <Panel
      title="Squad vs. Enemy Composition"
      subtitle="Which classes the enemy is running more or less of than us, by share of each side's roster - the read that actually says something about what to expect."
      icon={<Scale className="w-4 h-4" />}
      accent="text-amber-400"
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/50">
              <th className="p-2.5">Class</th>
              <th className="p-2.5 text-right">Squad</th>
              <th className="p-2.5 text-right">Enemy</th>
              <th className="p-2.5 text-right">Delta (share)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/30 font-mono">
            {rows.map((r) => {
              const st = profStyle(r.name);
              const heavy = Math.abs(r.deltaPct) >= 5;
              const enemyHeavier = r.deltaPct > 0;
              return (
                <tr key={r.name} className="hover:bg-blue-950/20 transition-colors">
                  <td className="p-2.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-sm ${st.dot} flex-shrink-0`} />
                      <span className="text-slate-200 font-semibold">{r.name}</span>
                    </div>
                  </td>
                  <td className="p-2.5 text-right text-sky-400">{fmtNum(r.squadCount)}</td>
                  <td className="p-2.5 text-right text-rose-400">{fmtNum(r.enemyCount)}</td>
                  <td className="p-2.5 text-right">
                    <span
                      className={`font-bold ${
                        !heavy ? "text-slate-500" : enemyHeavier ? "text-rose-400" : "text-sky-400"
                      }`}
                    >
                      {r.deltaPct > 0 ? "+" : ""}
                      {r.deltaPct.toFixed(1)}%
                      {heavy && (enemyHeavier ? " (enemy-heavy)" : " (squad-heavy)")}
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
}

function ClassDetailPanel({ title, data, total, accent = "text-sky-400" }: { title: string; data: ClassSlice[]; total: number; accent?: string }) {
  return (
    <Panel title={title} icon={<Layers className="w-4 h-4" />} accent={accent}>
      <div className="space-y-2">
        {data
          .slice()
          .sort((a, b) => b.value - a.value)
          .map((c) => {
            const pct = total > 0 ? (c.value / total) * 100 : 0;
            const st = profStyle(c.name);
            return (
              <div key={c.name} className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-sm ${st.dot} flex-shrink-0`} />
                <span className="text-xs font-semibold text-slate-300 w-28 flex-shrink-0">{c.name}</span>
                <div className="flex-1 h-5 bg-slate-800/40 rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: c.color }}
                  >
                    {pct > 8 && <span className="text-[10px] font-bold text-black/70">{c.value}</span>}
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-400 w-10 text-right">{fmtNum(c.value)}</span>
                <span className="text-[10px] font-mono text-slate-500 w-12 text-right">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
      </div>
    </Panel>
  );
}
