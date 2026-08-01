import { useMemo, useState } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import StatCard from "../components/ui/StatCard";
import { fmtNum, fmtCompact, fmtFixed, profChip } from "../utils/format";
import type { OffensePlayer } from "../types/report";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Swords,
  Target,
  Crosshair,
  Zap,
  Flame,
  ShieldOff,
  Users,
  ArrowUpDown,
  TrendingUp,
} from "lucide-react";

type SortKey =
  | "damage"
  | "dps"
  | "directDmg"
  | "downContribution"
  | "boonStrips"
  | "killed"
  | "account";

type SortDir = "asc" | "desc";

interface Row extends OffensePlayer {
  dps: number;
}

const COLUMNS: {
  key: SortKey;
  label: string;
  align: "left" | "right";
}[] = [
  { key: "account", label: "Player", align: "left" },
  { key: "damage", label: "Damage", align: "right" },
  { key: "dps", label: "DPS", align: "right" },
  { key: "directDmg", label: "Target/Cleave", align: "right" },
  { key: "downContribution", label: "Down Contrib", align: "right" },
  { key: "boonStrips", label: "Strips", align: "right" },
  { key: "killed", label: "Kills", align: "right" },
];

function numVal(row: Row, key: SortKey): number {
  if (key === "account") return 0;
  if (key === "dps") return row.dps;
  return row.offenseTotals[key as keyof typeof row.offenseTotals] as number;
}

function ChartTooltip({ active, payload, unit }: { active?: boolean; payload?: { name: string; value: number }[]; unit: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/80 backdrop-blur-xl px-3.5 py-2.5 shadow-2xl">
      <div className="text-[11px] font-bold text-slate-100">{p.name}</div>
      <div className="text-xs font-mono text-sky-400 mt-0.5">
        {Math.round(p.value).toLocaleString()} {unit}
      </div>
    </div>
  );
}

export default function OffensiveView() {
  const { report, loading } = useReport();
  const [sortKey, setSortKey] = useState<SortKey>("damage");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const rows = useMemo<Row[]>(() => {
    if (!report) return [];
    return report.stats.offensePlayers.map((p) => {
      const secs = p.totalFightMs / 1000;
      return { ...p, dps: secs > 0 ? p.offenseTotals.damage / secs : 0 };
    });
  }, [report]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === "account") {
        return sortDir === "asc"
          ? a.account.localeCompare(b.account)
          : b.account.localeCompare(a.account);
      }
      const av = numVal(a, sortKey);
      const bv = numVal(b, sortKey);
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 text-sm">
        Loading offensive stats…
      </div>
    );
  }
  if (!report) return null;

  const totalDamage = rows.reduce((a, r) => a + r.offenseTotals.damage, 0);
  const totalStrips = rows.reduce((a, r) => a + r.offenseTotals.boonStrips, 0);
  const totalCC = rows.reduce((a, r) => a + r.offenseTotals.appliedCrowdControl, 0);
  const totalDown = rows.reduce((a, r) => a + r.offenseTotals.downContribution, 0);

  const top5Dmg = [...rows]
    .sort((a, b) => b.offenseTotals.damage - a.offenseTotals.damage)
    .slice(0, 5)
    .map((r) => ({
      name: r.account.split(".")[0],
      value: r.offenseTotals.damage,
      dps: Math.round(r.dps),
    }));

  const top5Strips = [...rows]
    .sort((a, b) => b.offenseTotals.boonStrips - a.offenseTotals.boonStrips)
    .slice(0, 5)
    .map((r) => ({
      name: r.account.split(".")[0],
      value: r.offenseTotals.boonStrips,
    }));

  const maxDamage = Math.max(...sorted.map((r) => r.offenseTotals.damage), 1);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "account" ? "asc" : "desc");
    }
  }

  return (
    <div className="space-y-5 animate-view pb-12">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Damage" value={fmtCompact(totalDamage)} icon={<Swords className="w-3.5 h-3.5 text-orange-400" />} accent="text-orange-400" />
        <StatCard label="Down Contrib" value={fmtCompact(totalDown)} icon={<Target className="w-3.5 h-3.5 text-sky-400" />} accent="text-sky-400" />
        <StatCard label="Boon Strips" value={fmtNum(totalStrips)} icon={<Zap className="w-3.5 h-3.5 text-amber-400" />} accent="text-amber-400" />
        <StatCard label="Crowd Control" value={fmtNum(totalCC)} icon={<Crosshair className="w-3.5 h-3.5 text-rose-400" />} accent="text-rose-400" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Top 5 Damage Output" icon={<TrendingUp className="w-4 h-4" />} accent="text-orange-400">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top5Dmg} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id="dmgGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip unit="dmg" />} cursor={{ fill: "rgba(249,115,22,0.06)" }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22} fill="url(#dmgGradient)" animationDuration={600} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Top 5 Boon Strips" icon={<ShieldOff className="w-4 h-4" />} accent="text-amber-400">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top5Strips} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip unit="strips" />} cursor={{ fill: "rgba(245,158,11,0.08)" }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Sortable data table */}
      <Panel
        title="Offensive Breakdown"
        icon={<Flame className="w-4 h-4" />}
        accent="text-orange-400"
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/50">
                <th className="p-2.5">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />Group</span>
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className={`p-2.5 cursor-pointer select-none hover:text-slate-300 transition-colors ${
                      col.align === "right" ? "text-right" : ""
                    } ${sortKey === col.key ? "text-sky-400" : ""}`}
                  >
                    <span className={`inline-flex items-center gap-1 ${col.align === "right" ? "flex-row-reverse" : ""}`}>
                      {col.label}
                      <ArrowUpDown className={`w-3 h-3 ${sortKey === col.key ? "opacity-100" : "opacity-30"}`} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30 font-mono">
              {sorted.map((p, i) => {
                const dmgPct = (p.offenseTotals.damage / maxDamage) * 100;
                return (
                  <tr key={p.account} className={`transition-colors hover:bg-blue-950/20 ${i % 2 === 1 ? "bg-slate-900/20" : ""}`}>
                    {/* Subgroup - data has no group field, show neutral */}
                    <td className="p-2.5">
                      <span className="inline-flex items-center justify-center min-w-6 h-5 px-1.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700/50">
                        —
                      </span>
                    </td>
                    {/* Player */}
                    <td className="p-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(p.profession)}`}>
                          {p.profession}
                        </span>
                        <span className="text-slate-200 font-semibold whitespace-nowrap">{p.account}</span>
                      </div>
                    </td>
                    {/* Damage + inline bar */}
                    <td className="p-2.5 text-right relative">
                      <div className="absolute inset-y-0 left-2 right-2 my-1.5 rounded bg-orange-500/10" style={{ width: `${dmgPct}%`, maxWidth: "calc(100% - 1rem)" }} />
                      <span className="relative text-slate-200 font-semibold">{fmtCompact(p.offenseTotals.damage)}</span>
                    </td>
                    {/* DPS */}
                    <td className="p-2.5 text-right text-orange-400 font-bold">{fmtFixed(p.dps, 0)}</td>
                    {/* Target/Cleave -> directDmg proxy */}
                    <td className="p-2.5 text-right text-slate-300">{fmtCompact(p.offenseTotals.directDmg)}</td>
                    {/* Down contrib */}
                    <td className="p-2.5 text-right text-sky-400">{fmtCompact(p.offenseTotals.downContribution)}</td>
                    {/* Strips */}
                    <td className="p-2.5 text-right text-amber-400">{fmtNum(p.offenseTotals.boonStrips)}</td>
                    {/* Kills */}
                    <td className="p-2.5 text-right text-emerald-400">{p.offenseTotals.killed}</td>
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
