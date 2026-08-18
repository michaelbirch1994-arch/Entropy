import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import StatCard from "../components/ui/StatCard";
import { fmtNum, fmtFixed } from "../utils/format";
import { Map as MapIcon, Users, Clock } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { TOOLTIP_STYLE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, CHART_COLORS } from "../utils/chartTheme";

export default function MapDistributionView() {
  const { report } = useReport();
  if (!report) return null;
  const s = report.stats;
  const mapData = s.mapData;
  const total = mapData.reduce((a, c) => a + c.value, 0);

  return (
    <div className="space-y-5 animate-view pb-12">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Avg Squad Size" value={fmtFixed(s.avgSquadSize, 0)} icon={<Users className="w-3.5 h-3.5 text-cyan-400" />} accent="text-cyan-400" />
        <StatCard label="Avg Enemies" value={fmtFixed(s.avgEnemies, 0)} icon={<Users className="w-3.5 h-3.5 text-rose-400" />} accent="text-rose-400" />
        <StatCard label="Total Fights" value={fmtNum(s.total)} icon={<MapIcon className="w-3.5 h-3.5 text-sky-400" />} accent="text-sky-400" />
        <StatCard label="Borderlands %" value={`${fmtFixed(s.total > 0 ? (s.wins / s.total) * 100 : 0, 0)}%`} icon={<Clock className="w-3.5 h-3.5 text-emerald-400" />} accent="text-emerald-400" sub="win rate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Map pie */}
        <Panel title="Map Distribution" icon={<MapIcon className="w-4 h-4" />} accent="text-sky-400">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-1/2 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mapData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} paddingAngle={3}>
                    {mapData.map((c) => (
                      <Cell key={c.name} fill={c.color} stroke="#0a101f" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-3">
              {mapData.map((m) => {
                const pct = total > 0 ? (m.value / total) * 100 : 0;
                return (
                  <div key={m.name}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: m.color }} />
                      <span className="text-xs font-semibold text-slate-300">{m.name}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1">
                      <span>{m.value} fights</span>
                      <span>{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-slate-800/60 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: m.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>

        {/* Timeline */}
        <Panel title="Squad vs Enemy Per Fight" icon={<Users className="w-4 h-4" />} accent="text-emerald-400">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="index" tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" />
                <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                <Bar dataKey="squadCount" name="Squad" fill={CHART_COLORS.blue} radius={[3, 3, 0, 0]} />
                <Bar dataKey="enemies" name="Enemies" fill={CHART_COLORS.red} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}
