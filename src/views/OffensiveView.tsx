import { useMemo, useState } from "react";
import { useReport } from "../store/ReportContext";
import { useDamageScope, pickDamageScopeValue, type DamageScope } from "../store/DamageScopeContext";
import { useStatsDisplay } from "../store/StatsDisplayContext";
import Panel from "../components/ui/Panel";
import StatCard from "../components/ui/StatCard";
import PlayerSampleCell from "../components/ui/PlayerSampleCell";
import { fmtNum, fmtCompact, fmtFixed, fmtFixedGrouped, profChip } from "../utils/format";
import type { OffensePlayer } from "../types/report";
import { resolvePlayerSampleContext, type PlayerSampleContextData } from "../lib/playerSampleContext";
import { rateByActiveMs } from "../lib/playerRate";
import { hasNonPlayerObjectiveDamage, nonPlayerObjectiveDamage } from "../lib/offenseColumns";
import { normalizeOffensePlayers } from "../lib/offensivePlayerNormalization";
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
  ArrowUpDown,
  TrendingUp,
  Building2,
} from "lucide-react";

type SortKey =
  | "damage"
  | "dps"
  | "directDmg"
  | "downContribution"
  | "boonStrips"
  | "killed"
  | "critRate"
  | "flankRate"
  | "glanceRate"
  | "interrupts"
  | "invulned"
  | "sample"
  | "account";

type SortDir = "asc" | "desc";

interface Row extends OffensePlayer {
  dps: number;
  sample: PlayerSampleContextData;
  // EI's "criticalRate"/"flankingRate"/"glanceRate" fields are actually raw
  // hit counts, not percentages - offenseRateWeights carries the matching
  // denominator (critable / connected direct-damage hit count) so the real
  // percent is count/denom, computed once here rather than re-derived per cell.
  critRate: number;
  flankRate: number;
  glanceRate: number;
}

const COLUMNS: {
  key: SortKey;
  label: string;
  align: "left" | "right";
}[] = [
  { key: "account", label: "Player", align: "left" },
  { key: "sample", label: "Sample", align: "right" },
  { key: "damage", label: "Damage", align: "right" },
  { key: "dps", label: "DPS", align: "right" },
  { key: "directDmg", label: "Target/Cleave", align: "right" },
  { key: "downContribution", label: "Down Contrib", align: "right" },
  { key: "critRate", label: "Crit %", align: "right" },
  { key: "flankRate", label: "Flank %", align: "right" },
  { key: "glanceRate", label: "Glance %", align: "right" },
  { key: "interrupts", label: "Interrupts", align: "right" },
  { key: "invulned", label: "Invulned", align: "right" },
  { key: "boonStrips", label: "Strips", align: "right" },
  { key: "killed", label: "Kills", align: "right" },
];

const RATE_AWARE_COLUMNS = new Set<SortKey>([
  "damage",
  "directDmg",
  "downContribution",
  "interrupts",
  "boonStrips",
  "killed",
]);

function numVal(row: Row, key: SortKey, scope: DamageScope, perSecond: boolean): number {
  if (key === "account") return 0;
  if (key === "sample") return row.sample.fights;
  if (key === "dps") return row.dps;
  if (key === "critRate") return row.critRate;
  if (key === "flankRate") return row.flankRate;
  if (key === "glanceRate") return row.glanceRate;

  if (key === "damage") {
    return rateByActiveMs(
      pickDamageScopeValue(scope, row.offenseTotals.damage, row.offenseTotals.damageAll),
      row.totalFightMs,
      perSecond,
    );
  }

  // offenseTotals is a sparse Record<string, number> - a metric that never
  // fired for this player (e.g. 0 boon strips) has no key at all, not a 0.
  // Guard every lookup so one sparse player can't turn a whole column's
  // sort into NaN-driven nonsense.
  const raw = (row.offenseTotals[key as keyof typeof row.offenseTotals] as number) ?? 0;
  return RATE_AWARE_COLUMNS.has(key) ? rateByActiveMs(raw, row.totalFightMs, perSecond) : raw;
}

function ChartTooltip({ active, payload, unit }: { active?: boolean; payload?: { name: string; value: number }[]; unit: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/80 backdrop-blur-xl px-3.5 py-2.5 shadow-2xl">
      <div className="text-[11px] font-bold text-slate-100">{p.name}</div>
      <div className="text-xs font-mono text-slate-100 mt-0.5">
        {Math.round(p.value).toLocaleString()} {unit}
      </div>
    </div>
  );
}

export default function OffensiveView() {
  const { report, loading } = useReport();
  const { scope } = useDamageScope();
  const { mode } = useStatsDisplay();
  const isPerSecond = mode === "perSecond";
  // Per-player cells divide by that player's own tracked fight time, not a
  // squad-wide clock, so a "/s" column rates each player against the time
  // they were actually in the fight.
  const perPlayer = (v: number, ms: number | undefined) =>
    isPerSecond ? (ms && ms > 0 ? fmtFixed(rateByActiveMs(v, ms, true), 2) : "-") : fmtCompact(v);
  const perPlayerN = (v: number, ms: number | undefined) =>
    isPerSecond ? (ms && ms > 0 ? fmtFixed(rateByActiveMs(v, ms, true), 2) : "-") : fmtNum(v);
  const [sortKey, setSortKey] = useState<SortKey>("damage");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const rows = useMemo<Row[]>(() => {
    if (!report) return [];
    // Modern reports already contain one offense row per account. Archived
    // reports can still contain profession-split slices after a build swap;
    // recombine those slices so totals and hit-rate denominators stay complete.
    const players = normalizeOffensePlayers(report.stats.offensePlayers);
    return players.map((p) => {
      const secs = p.totalFightMs / 1000;
      const sample = resolvePlayerSampleContext(
        report.stats.generalPlayers,
        report.stats.total,
        p.account,
        { activeMs: p.totalFightMs },
      );
      const weights = p.offenseRateWeights ?? {};
      const pct = (id: "criticalRate" | "flankingRate" | "glanceRate") => {
        const denom = weights[id] || 0;
        return denom > 0 ? ((p.offenseTotals[id] ?? 0) / denom) * 100 : 0;
      };
      return {
        ...p,
        dps: secs > 0 ? pickDamageScopeValue(scope, p.offenseTotals.damage, p.offenseTotals.damageAll) / secs : 0,
        sample,
        critRate: pct("criticalRate"),
        flankRate: pct("flankingRate"),
        glanceRate: pct("glanceRate"),
      };
    });
  }, [report, scope]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === "account") {
        return sortDir === "asc"
          ? a.account.localeCompare(b.account)
          : b.account.localeCompare(a.account);
      }
      const av = numVal(a, sortKey, scope, isPerSecond);
      const bv = numVal(b, sortKey, scope, isPerSecond);
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return copy;
  }, [rows, sortKey, sortDir, scope, isPerSecond]);

  const derived = useMemo(() => {
    // offenseTotals is sparse - see the comment on numVal() above. Every read
    // here is guarded with `?? 0` so one player missing a key can't turn a
    // summary card, chart, or the dmgPct bar into NaN/blank for the whole page.
    const totalDamage = rows.reduce((a, r) => a + pickDamageScopeValue(scope, r.offenseTotals.damage, r.offenseTotals.damageAll), 0);
    const totalStrips = rows.reduce((a, r) => a + (r.offenseTotals.boonStrips ?? 0), 0);
    const totalCC = rows.reduce((a, r) => a + (r.offenseTotals.appliedCrowdControl ?? 0), 0);
    const totalDown = rows.reduce((a, r) => a + (r.offenseTotals.downContribution ?? 0), 0);
    // damageAll (EI's "All" column) includes hits against siege weapons, NPCs,
    // gates and walls alongside tracked player targets; damage (post-#78 fix)
    // is player-vs-player only. The gap between them is the closest honest
    // proxy for "siege/objective damage" EI's export supports - it can't be
    // split further into siege vs. gate vs. NPC without per-hit target-type
    // data the JSON doesn't expose.
    const hasSiegeData = hasNonPlayerObjectiveDamage(rows);
    const totalSiegeDamage = rows.reduce((a, r) => a + nonPlayerObjectiveDamage(r), 0);
    const byDamage = [...rows].sort(
      (a, b) => pickDamageScopeValue(scope, b.offenseTotals.damage, b.offenseTotals.damageAll) - pickDamageScopeValue(scope, a.offenseTotals.damage, a.offenseTotals.damageAll),
    );
    const top5Dmg = byDamage.slice(0, 5).map((r) => ({
      name: r.account.split(".")[0],
      value: pickDamageScopeValue(scope, r.offenseTotals.damage, r.offenseTotals.damageAll),
      dps: Math.round(r.dps),
    }));

    const top5Strips = [...rows]
      .sort((a, b) => (b.offenseTotals.boonStrips ?? 0) - (a.offenseTotals.boonStrips ?? 0))
      .slice(0, 5)
      .map((r) => ({
        name: r.account.split(".")[0],
        value: r.offenseTotals.boonStrips ?? 0,
      }));

    const maxDamage = Math.max(...byDamage.map((r) => pickDamageScopeValue(scope, r.offenseTotals.damage, r.offenseTotals.damageAll)), 1);

    return {
      totalDamage,
      totalStrips,
      totalCC,
      totalDown,
      hasSiegeData,
      totalSiegeDamage,
      top5Dmg,
      top5Strips,
      maxDamage,
    };
  }, [rows, scope]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 text-sm">
        Loading offensive stats…
      </div>
    );
  }
  if (!report) return null;

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
      <div className={`grid grid-cols-2 gap-4 ${derived.hasSiegeData ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        <StatCard label="Total Damage" value={fmtCompact(derived.totalDamage)} icon={<Swords className="w-3.5 h-3.5 text-orange-400" />} accent="text-orange-400" />
        <StatCard label="Down Contrib" value={fmtCompact(derived.totalDown)} icon={<Target className="w-3.5 h-3.5 text-amber-400" />} accent="text-amber-300" />
        <StatCard label="Boon Strips" value={fmtNum(derived.totalStrips)} icon={<Zap className="w-3.5 h-3.5 text-amber-400" />} accent="text-amber-400" />
        <StatCard label="Crowd Control" value={fmtNum(derived.totalCC)} icon={<Crosshair className="w-3.5 h-3.5 text-rose-400" />} accent="text-rose-400" />
        {derived.hasSiegeData && (
          <StatCard
            label="Siege/NPC/Gate Dmg"
            value={fmtCompact(derived.totalSiegeDamage)}
            icon={<Building2 className="w-3.5 h-3.5 text-slate-400" />}
            accent="text-slate-400"
          />
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Top 5 Damage Output" icon={<TrendingUp className="w-4 h-4" />}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={derived.top5Dmg} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
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

        <Panel title="Top 5 Boon Strips" icon={<ShieldOff className="w-4 h-4" />}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={derived.top5Strips} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
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
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/50">
                {COLUMNS.map((col) => {
                  const label = isPerSecond && RATE_AWARE_COLUMNS.has(col.key) ? `${col.label}/s` : col.label;
                  return (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className={`p-2.5 cursor-pointer select-none hover:text-slate-300 transition-colors ${
                        col.align === "right" ? "text-right" : ""
                      } ${sortKey === col.key ? "text-theme-accentStrong" : ""}`}
                    >
                      <span className={`inline-flex items-center gap-1 ${col.align === "right" ? "flex-row-reverse" : ""}`}>
                        {label}
                        <ArrowUpDown className={`w-3 h-3 ${sortKey === col.key ? "opacity-100" : "opacity-30"}`} />
                      </span>
                    </th>
                  );
                })}
                {derived.hasSiegeData && <th className="p-2.5 text-right">Siege/NPC/Gate</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30 font-mono">
              {sorted.map((p, i) => {
                const dmgPct = (pickDamageScopeValue(scope, p.offenseTotals.damage, p.offenseTotals.damageAll) / derived.maxDamage) * 100;
                return (
                  <tr key={p.account} className={`transition-colors hover:bg-white/[0.025] ${i % 2 === 1 ? "bg-slate-900/20" : ""}`}>
                    {/* Player */}
                    <td className="p-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(p.profession)}`}>
                          {p.profession}
                        </span>
                        <span className="text-slate-200 font-semibold whitespace-nowrap">{p.account}</span>
                      </div>
                    </td>
                    <td className="p-2.5 text-right">
                      <PlayerSampleCell sample={p.sample} />
                    </td>
                    {/* Damage + inline bar */}
                    <td className="p-2.5 text-right relative">
                      <div className="absolute inset-y-0 left-2 right-2 my-1.5 rounded bg-orange-500/10" style={{ width: `${dmgPct}%`, maxWidth: "calc(100% - 1rem)" }} />
                      <span className="relative text-slate-200 font-semibold">{perPlayer(pickDamageScopeValue(scope, p.offenseTotals.damage, p.offenseTotals.damageAll), p.totalFightMs)}</span>
                    </td>
                    {/* DPS */}
                    <td className="p-2.5 text-right text-orange-400 font-bold">{fmtFixedGrouped(p.dps, 0)}</td>
                    {/* Target/Cleave -> directDmg proxy */}
                    <td className="p-2.5 text-right text-slate-300">{perPlayer(p.offenseTotals.directDmg ?? 0, p.totalFightMs)}</td>
                    {/* Down contrib */}
                    <td className="p-2.5 text-right text-amber-300">{perPlayer(p.offenseTotals.downContribution ?? 0, p.totalFightMs)}</td>
                    {/* Crit % */}
                    <td className="p-2.5 text-right text-slate-300">{fmtFixed(p.critRate, 1)}%</td>
                    {/* Flank % */}
                    <td className="p-2.5 text-right text-slate-300">{fmtFixed(p.flankRate, 1)}%</td>
                    {/* Glance % */}
                    <td className="p-2.5 text-right text-slate-400">{fmtFixed(p.glanceRate, 1)}%</td>
                    {/* Interrupts */}
                    <td className="p-2.5 text-right text-slate-300">{perPlayerN(p.offenseTotals.interrupts ?? 0, p.totalFightMs)}</td>
                    {/* Invulned (times the enemy target was invulnerable to this player's hits) */}
                    <td className="p-2.5 text-right text-slate-400">{fmtNum(p.offenseTotals.invulned ?? 0)}</td>
                    {/* Strips */}
                    <td className="p-2.5 text-right text-amber-400">{perPlayerN(p.offenseTotals.boonStrips ?? 0, p.totalFightMs)}</td>
                    {/* Kills */}
                    <td className="p-2.5 text-right text-emerald-400">{perPlayerN(p.offenseTotals.killed ?? 0, p.totalFightMs)}</td>
                    {derived.hasSiegeData && (
                      <td className="p-2.5 text-right text-slate-500">
                        {fmtCompact(nonPlayerObjectiveDamage(p))}
                      </td>
                    )}
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
