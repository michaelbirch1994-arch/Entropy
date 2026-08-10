import { useState } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import LeaderboardTable from "../components/ui/LeaderboardTable";
import ProfessionIcon from "../components/ui/ProfessionIcon";
import type { LeaderboardEntry } from "../types/report";
import { fmtCompact, fmtNum, profChip, profStyle } from "../utils/format";
import { Trophy, Swords, Heart, Shield, Zap, Droplet, Target, Wind } from "lucide-react";

type MetricKey =
  | "dps"
  | "damage"
  | "downContrib"
  | "healing"
  | "barrier"
  | "cleanses"
  | "strips"
  | "stability"
  | "cc"
  | "interrupts"
  | "dodges"
  | "kills";

const METRICS: { key: MetricKey; label: string; icon: typeof Trophy; unit?: string }[] = [
  { key: "dps", label: "DPS", icon: Swords, unit: "" },
  { key: "damage", label: "Total Damage", icon: Swords },
  { key: "downContrib", label: "Down Contribution", icon: Trophy },
  { key: "healing", label: "Healing", icon: Heart },
  { key: "barrier", label: "Barrier", icon: Shield },
  { key: "cleanses", label: "Cleanses", icon: Droplet },
  { key: "strips", label: "Strips", icon: Zap },
  { key: "stability", label: "Stability", icon: Shield },
  { key: "cc", label: "Crowd Control", icon: Target },
  { key: "interrupts", label: "Interrupts", icon: Zap },
  { key: "dodges", label: "Dodges", icon: Wind },
  { key: "kills", label: "Kills", icon: Swords },
];

function formatMetricValue(entry: LeaderboardEntry, unit?: string) {
  if (unit === "") return Math.round(entry.value).toLocaleString();
  return entry.value >= 100000 ? fmtCompact(entry.value) : fmtNum(entry.value);
}

function leaderboardSnapshotKey(metric: MetricKey, entries: LeaderboardEntry[]) {
  return `${metric}:${entries.slice(0, 12).map((entry) => `${entry.account}:${entry.profession}:${entry.rank}:${entry.value}:${entry.count}`).join("|")}`;
}

function PlayerMetricCard({
  entry,
  index,
  max,
  metricLabel,
  unit,
}: {
  entry: LeaderboardEntry;
  index: number;
  max: number;
  metricLabel: string;
  unit?: string;
}) {
  const style = profStyle(entry.profession);
  const share = max > 0 ? Math.max(4, (entry.value / max) * 100) : 4;

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#0a101f]/90 p-4 shadow-lg transition-colors hover:border-slate-700">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border ${profChip(entry.profession)}`}>
            <ProfessionIcon profession={entry.profession} className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-100">{entry.account}</div>
            <div className="mt-0.5 text-[10px] font-mono text-slate-500">{entry.profession}</div>
          </div>
        </div>
        <span className={`font-mono text-xs font-black ${entry.rank <= 3 ? "text-amber-400" : "text-slate-500"}`}>
          #{entry.rank || index + 1}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{metricLabel}</div>
            <div className="mt-1 font-mono text-2xl font-black text-slate-100">
              {formatMetricValue(entry, unit)}
              {unit && <span className="ml-1 text-[10px] font-bold text-slate-500">{unit}</span>}
            </div>
          </div>
          <div className="text-right text-[10px] font-mono text-slate-500">{entry.count} logs</div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800/60">
          <div className={`h-full rounded-full ${style.dot} transition-all duration-500`} style={{ width: `${share}%` }} />
        </div>
        <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Share of current leader
        </div>
      </div>
    </div>
  );
}

export default function TopPlayersView() {
  const { report } = useReport();
  const [metric, setMetric] = useState<MetricKey>("downContrib");
  if (!report) return null;
  const lb = report.stats.leaderboards;
  const entries: LeaderboardEntry[] = lb[metric] ?? [];
  const active = METRICS.find((m) => m.key === metric)!;
  const maxValue = entries.length ? entries[0].value : 1;
  const snapshotKey = leaderboardSnapshotKey(metric, entries);

  return (
    <div className="space-y-5 animate-view pb-12" key={`top-players:${snapshotKey}`}>
      {/* Metric selector */}
      <div className="flex flex-wrap gap-2">
        {METRICS.map((m) => {
          const Icon = m.icon;
          const isActive = metric === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 border ${
                isActive
                  ? "bg-sky-500/15 text-sky-400 border-sky-500/40 shadow-[0_0_20px_rgba(59,130,246,0.15)]"
                  : "bg-[#0a101f] text-slate-500 border-slate-800 hover:border-slate-700 hover:text-slate-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Top 3 podium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" key={`podium:${snapshotKey}`}>
        {entries.slice(0, 3).map((e, i) => {
          const place = i + 1;
          const colors = ["text-amber-400", "text-slate-300", "text-orange-400"];
          const borders = ["border-amber-500/40", "border-slate-500/40", "border-orange-600/40"];
          return (
            <div
              key={`${metric}:podium:${e.account}:${e.profession}:${e.rank}:${e.value}`}
              className={`bg-[#0a101f]/90 border ${borders[i]} rounded-2xl p-4 shadow-xl flex items-center gap-4`}
            >
              <div className={`text-3xl font-black font-mono ${colors[i]}`}>#{place}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-100 truncate">{e.account}</div>
                <div className="text-[10px] text-slate-500 font-mono">{e.profession}</div>
                <div className={`text-lg font-black font-mono ${colors[i]} mt-1`}>
                  {formatMetricValue(e, active.unit)}
                  {active.unit && <span className="ml-1 text-[10px] text-slate-500">{active.unit}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Metric-bound player cards */}
      <Panel
        key={`panel:${snapshotKey}`}
        title={`${active.label} Player Cards`}
        subtitle="These cards are driven by the same selected metric as the podium and table."
        icon={<active.icon className="w-4 h-4" />}
        accent="text-sky-400"
      >
        {entries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" key={`cards:${snapshotKey}`}>
            {entries.slice(0, 12).map((entry, index) => (
              <PlayerMetricCard
                key={`${metric}:card:${entry.account}:${entry.profession}:${entry.rank}:${entry.value}:${entry.count}`}
                entry={entry}
                index={index}
                max={maxValue}
                metricLabel={active.label}
                unit={active.unit}
              />
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-slate-500">No leaderboard data available for {active.label}.</div>
        )}
      </Panel>

      {/* Full leaderboard */}
      <Panel title={`${active.label} Leaderboard`} icon={<active.icon className="w-4 h-4" />} accent="text-sky-400">
        <LeaderboardTable entries={entries} metricLabel={active.label} unit={active.unit} />
      </Panel>
    </div>
  );
}
