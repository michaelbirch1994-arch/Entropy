import { useState } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import LeaderboardTable from "../components/ui/LeaderboardTable";
import type { LeaderboardEntry } from "../types/report";
import { Trophy, Swords, Heart, Shield, Zap, Droplet, Target, Wind } from "lucide-react";

const METRICS: { key: string; label: string; icon: typeof Trophy; unit?: string }[] = [
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

export default function TopPlayersView() {
  const { report } = useReport();
  const [metric, setMetric] = useState("downContrib");
  if (!report) return null;
  const lb = report.stats.leaderboards;
  const entries: LeaderboardEntry[] = lb[metric] ?? [];
  const active = METRICS.find((m) => m.key === metric)!;

  return (
    <div className="space-y-5 animate-view pb-12">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {entries.slice(0, 3).map((e, i) => {
          const place = i + 1;
          const colors = ["text-amber-400", "text-slate-300", "text-orange-400"];
          const borders = ["border-amber-500/40", "border-slate-500/40", "border-orange-600/40"];
          return (
            <div
              key={e.account}
              className={`bg-[#0a101f]/90 border ${borders[i]} rounded-2xl p-4 shadow-xl flex items-center gap-4`}
            >
              <div className={`text-3xl font-black font-mono ${colors[i]}`}>#{place}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-100 truncate">{e.account}</div>
                <div className="text-[10px] text-slate-500 font-mono">{e.profession}</div>
                <div className={`text-lg font-black font-mono ${colors[i]} mt-1`}>
                  {active.unit === "" ? e.value.toFixed(0) : Math.round(e.value).toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full leaderboard */}
      <Panel title={`${active.label} Leaderboard`} icon={<active.icon className="w-4 h-4" />} accent="text-sky-400">
        <LeaderboardTable entries={entries} metricLabel={active.label} unit={active.unit} />
      </Panel>
    </div>
  );
}
