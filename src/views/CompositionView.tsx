import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import { profStyle, fmtNum } from "../utils/format";
import type { ClassSlice } from "../types/report";
import { Layers, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TOOLTIP_STYLE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE } from "../utils/chartTheme";

export default function CompositionView() {
  const { report } = useReport();
  if (!report) return null;
  const s = report.stats;
  const squadTotal = s.squadClassData.reduce((a, c) => a + c.value, 0);

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ClassDetailPanel title="Squad Classes" data={s.squadClassData} total={squadTotal} />
        <ClassDetailPanel
          title="Enemy Classes"
          data={s.enemyClassData}
          total={s.enemyClassData.reduce((a, c) => a + c.value, 0)}
          accent="text-rose-400"
        />
      </div>
    </div>
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
