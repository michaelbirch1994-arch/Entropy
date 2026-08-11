import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import StatCard from "../components/ui/StatCard";
import { fmtNum, fmtFixed, fmtDur, profChip } from "../utils/format";
import { Crown, Swords, Shield, Clock, Target, Skull } from "lucide-react";

export default function CommanderStatsView() {
  const { report } = useReport();
  if (!report) return null;
  const s = report.stats;
  const rows = s.commanderStats?.rows ?? [];

  if (rows.length === 0) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel title="Commander Stats" icon={<Crown className="w-4 h-4" />} accent="text-sky-400">
          <div className="py-10 text-center text-sm text-slate-400">
            No commander stats available for this report.
            <p className="text-[11px] text-slate-600 mt-1">
              This section isn't computed yet for reports built from raw .zevtc / dps.report imports - only for
              legacy report.json uploads.
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-view pb-12">
      {/* Commander summary cards */}
      {rows.map((c) => (
        <div key={c.account} className="space-y-4">
          <div className="bg-[#0a101f]/90 border border-sky-500/20 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full border-2 border-sky-500/50 flex items-center justify-center bg-sky-500/10">
                <Crown className="w-6 h-6 text-sky-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-black text-slate-100">{c.characterNames.join(", ") || c.account}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${profChip(c.profession)}`}>
                    {c.profession}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">{c.account}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black font-mono text-sky-400">{fmtFixed(c.winRatePct, 0)}%</div>
                <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Win Rate</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <StatCard label="Fights" value={fmtNum(c.fights)} icon={<Swords className="w-3.5 h-3.5 text-sky-400" />} accent="text-sky-400" />
              <StatCard label="Wins" value={fmtNum(c.wins)} icon={<Swords className="w-3.5 h-3.5 text-emerald-400" />} accent="text-emerald-400" />
              <StatCard label="Losses" value={fmtNum(c.losses)} icon={<Skull className="w-3.5 h-3.5 text-rose-400" />} accent="text-rose-400" />
              <StatCard label="KDR" value={fmtFixed(c.kdr, 2)} icon={<Target className="w-3.5 h-3.5 text-amber-400" />} accent="text-amber-400" />
              <StatCard label="Kills" value={fmtNum(c.kills)} icon={<Swords className="w-3.5 h-3.5 text-emerald-400" />} accent="text-emerald-400" />
              <StatCard label="Duration" value={fmtDur(c.totalDurationMs)} icon={<Clock className="w-3.5 h-3.5 text-slate-400" />} accent="text-slate-300" />
            </div>
          </div>

          {/* Detailed stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Panel title="Engagement Stats" icon={<Swords className="w-4 h-4" />} accent="text-sky-400">
              <div className="grid grid-cols-2 gap-3">
                <Detail label="Avg Squad Size" value={fmtFixed(c.avgSquadSize, 1)} />
                <Detail label="Avg Enemy Size" value={fmtFixed(c.avgEnemySize, 1)} />
                <Detail label="Total Kills" value={fmtNum(c.kills)} color="text-emerald-400" />
                <Detail label="Total Downs" value={fmtNum(c.downs)} color="text-sky-400" />
                <Detail label="Commander Downs" value={fmtNum(c.commanderDowns)} color="text-amber-400" />
                <Detail label="Commander Deaths" value={fmtNum(c.commanderDeaths)} color="text-rose-400" />
                <Detail label="Allies Down" value={fmtNum(c.alliesDown)} color="text-orange-400" />
                <Detail label="Allies Dead" value={fmtNum(c.alliesDead)} color="text-rose-400" />
              </div>
            </Panel>

            <Panel title="Survivability" icon={<Shield className="w-4 h-4" />} accent="text-teal-400">
              <div className="grid grid-cols-2 gap-3">
                <Detail label="Damage Taken" value={fmtNum(c.damageTaken)} color="text-rose-400" />
                <Detail label="Dmg Taken /min" value={fmtNum(c.damageTakenPerMinute)} color="text-orange-400" />
                <Detail label="Barrier Absorbed" value={fmtNum(c.incomingBarrierAbsorbed)} color="text-teal-400" />
                <Detail
                  label="Barrier /min"
                  value={fmtNum(c.incomingBarrierAbsorbedPerMinute ?? 0)}
                  color="text-cyan-400"
                />
              </div>
            </Panel>
          </div>
        </div>
      ))}
    </div>
  );
}

function Detail({ label, value, color = "text-slate-200" }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-slate-900/30 border border-slate-800/50 rounded-lg px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">{label}</div>
      <div className={`text-sm font-black font-mono ${color}`}>{value}</div>
    </div>
  );
}
