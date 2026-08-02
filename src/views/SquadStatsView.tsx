import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import StatCard from "../components/ui/StatCard";
import { fmtNum, fmtCompact, fmtFixed, fmtFixedGrouped } from "../utils/format";
import { Users, Swords, Shield, Heart, Zap, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TOOLTIP_STYLE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, CHART_COLORS } from "../utils/chartTheme";

export default function SquadStatsView() {
  const { report } = useReport();
  if (!report) return null;
  const s = report.stats;

  // Aggregate squad totals from player arrays. healingTotals is a sparse
  // Record<string, number> - a player who did zero outgoing healing/barrier
  // this session (e.g. a pure-DPS build) never gets a 'healing'/'barrier' key
  // written at all, so it's `undefined` rather than 0. A bare `a + p.x` turns
  // into `a + undefined` -> NaN for the *entire* reduce the moment one such
  // player is hit, which is why these totals were rendering as "-". `?? 0`
  // guards every field the same way, in case any of them end up sparse too.
  const totalDamage = s.offensePlayers.reduce((a, p) => a + (p.offenseTotals.damage ?? 0), 0);
  const totalDownContrib = s.offensePlayers.reduce((a, p) => a + (p.offenseTotals.downContribution ?? 0), 0);
  const totalHealing = s.healingPlayers.reduce((a, p) => a + (p.healingTotals.healing ?? 0), 0);
  const totalBarrier = s.healingPlayers.reduce((a, p) => a + (p.healingTotals.barrier ?? 0), 0);
  const totalCleanses = s.supportPlayers.reduce((a, p) => a + (p.supportTotals.condiCleanse ?? 0), 0);
  const totalStrips = s.supportPlayers.reduce((a, p) => a + (p.supportTotals.boonStrips ?? 0), 0);

  const topDps = [...s.offensePlayers]
    .map((p) => ({ account: p.account, profession: p.profession, dps: p.offenseTotals.damage / (p.totalFightMs / 1000) }))
    .sort((a, b) => b.dps - a.dps)
    .slice(0, 10);

  const chartData = topDps.map((p) => ({ name: p.account.split(".")[0], DPS: Math.round(p.dps), profession: p.profession }));

  return (
    <div className="space-y-5 animate-view pb-12">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Total Damage" value={fmtCompact(totalDamage)} icon={<Swords className="w-3.5 h-3.5 text-orange-400" />} accent="text-orange-400" />
        <StatCard label="Down Contrib" value={fmtCompact(totalDownContrib)} icon={<Target className="w-3.5 h-3.5 text-sky-400" />} accent="text-sky-400" />
        <StatCard label="Total Healing" value={fmtCompact(totalHealing)} icon={<Heart className="w-3.5 h-3.5 text-emerald-400" />} accent="text-emerald-400" />
        <StatCard label="Total Barrier" value={fmtCompact(totalBarrier)} icon={<Shield className="w-3.5 h-3.5 text-teal-400" />} accent="text-teal-400" />
        <StatCard label="Cleanses" value={fmtNum(totalCleanses)} icon={<Zap className="w-3.5 h-3.5 text-cyan-400" />} accent="text-cyan-400" />
        <StatCard label="Strips" value={fmtNum(totalStrips)} icon={<Zap className="w-3.5 h-3.5 text-amber-400" />} accent="text-amber-400" />
      </div>

      {/* DPS chart */}
      <Panel title="Top 10 DPS" icon={<Swords className="w-4 h-4" />} accent="text-orange-400">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} stroke="#334155" />
              <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} stroke="#334155" width={80} />
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
              <Bar dataKey="DPS" fill={CHART_COLORS.orange} radius={[0, 4, 4, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Squad summary table */}
      <Panel title="Squad Roster Overview" icon={<Users className="w-4 h-4" />} accent="text-sky-400" bodyClassName="p-0">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/50">
                <th className="p-2.5">Player</th>
                <th className="p-2.5">Class</th>
                <th className="p-2.5 text-right">Damage</th>
                <th className="p-2.5 text-right">DPS</th>
                <th className="p-2.5 text-right">Down Contrib</th>
                <th className="p-2.5 text-right">Healing</th>
                <th className="p-2.5 text-right">Cleanses</th>
                <th className="p-2.5 text-right">Strips</th>
                <th className="p-2.5 text-right">Logs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30 font-mono">
              {s.offensePlayers.slice(0, 25).map((p) => {
                const heal = s.healingPlayers.find((h) => h.account === p.account);
                const sup = s.supportPlayers.find((sp) => sp.account === p.account);
                const dps = p.offenseTotals.damage / (p.totalFightMs / 1000);
                return (
                  <tr key={p.account} className="hover:bg-blue-950/20 transition-colors">
                    <td className="p-2.5 text-slate-200 font-semibold whitespace-nowrap">{p.account}</td>
                    <td className="p-2.5 text-slate-400">{p.profession}</td>
                    <td className="p-2.5 text-right text-orange-400">{fmtCompact(p.offenseTotals.damage)}</td>
                    <td className="p-2.5 text-right text-slate-200 font-bold">{fmtFixedGrouped(dps, 0)}</td>
                    <td className="p-2.5 text-right text-sky-400">{fmtCompact(p.offenseTotals.downContribution)}</td>
                    <td className="p-2.5 text-right text-emerald-400">{heal ? fmtCompact(heal.healingTotals.healing ?? 0) : "—"}</td>
                    <td className="p-2.5 text-right text-cyan-400">{sup ? fmtNum(sup.supportTotals.condiCleanse) : "—"}</td>
                    <td className="p-2.5 text-right text-amber-400">{sup ? fmtNum(sup.supportTotals.boonStrips) : "—"}</td>
                    <td className="p-2.5 text-right text-slate-500">{s.generalPlayers.find((g) => g.account === p.account)?.logsJoined ?? "—"}</td>
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
