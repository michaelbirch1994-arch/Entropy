import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import StatCard from "../components/ui/StatCard";
import { fmtNum, fmtFixed } from "../utils/format";
import { Swords, Skull, Crosshair, Users, TrendingUp, TrendingDown } from "lucide-react";

export default function KdrView() {
  const { report } = useReport();
  if (!report) return null;
  const s = report.stats;

  const squadKdr = s.squadKDR;
  const enemyKdr = s.enemyKDR;
  const winRate = s.total > 0 ? (s.wins / s.total) * 100 : 0;

  return (
    <div className="space-y-6 animate-view pb-12">
      {/* KDR summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Squad KDR"
          value={fmtFixed(squadKdr, 2)}
          icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
          accent="text-emerald-400"
          sub={`${fmtNum(s.totalSquadKills)} kills / ${fmtNum(s.totalSquadDeaths)} deaths`}
        />
        <StatCard
          label="Enemy KDR"
          value={fmtFixed(enemyKdr, 2)}
          icon={<TrendingDown className="w-3.5 h-3.5 text-rose-400" />}
          accent="text-rose-400"
          sub={`${fmtNum(s.totalEnemyKills)} kills / ${fmtNum(s.totalEnemyDeaths)} deaths`}
        />
        <StatCard
          label="Win Rate"
          value={`${fmtFixed(winRate, 1)}%`}
          icon={<Swords className="w-3.5 h-3.5 text-sky-400" />}
          accent="text-sky-400"
          sub={`${s.wins}W / ${s.losses}L of ${s.total}`}
        />
        <StatCard
          label="Avg Squad Size"
          value={fmtFixed(s.avgSquadSize, 0)}
          icon={<Users className="w-3.5 h-3.5 text-cyan-400" />}
          accent="text-cyan-400"
          sub={`vs ${fmtFixed(s.avgEnemies, 0)} enemies`}
        />
      </div>

      {/* Kill/Death comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Squad Performance" icon={<Swords className="w-4 h-4" />} accent="text-emerald-400">
          <div className="space-y-4">
            <KdrBar label="Kills" value={s.totalSquadKills} max={Math.max(s.totalSquadKills, s.totalSquadDeaths)} color="bg-emerald-500" />
            <KdrBar label="Downs" value={s.totalSquadDowns} max={Math.max(s.totalSquadDowns, s.totalEnemyDowns)} color="bg-sky-500" />
            <KdrBar label="Deaths" value={s.totalSquadDeaths} max={Math.max(s.totalSquadKills, s.totalSquadDeaths)} color="bg-rose-500" />
          </div>
        </Panel>

        <Panel title="Enemy Performance" icon={<Skull className="w-4 h-4" />} accent="text-rose-400">
          <div className="space-y-4">
            <KdrBar label="Kills" value={s.totalEnemyKills} max={Math.max(s.totalSquadKills, s.totalEnemyKills)} color="bg-rose-500" />
            <KdrBar label="Downs" value={s.totalEnemyDowns} max={Math.max(s.totalSquadDowns, s.totalEnemyDowns)} color="bg-orange-500" />
            <KdrBar label="Deaths" value={s.totalEnemyDeaths} max={Math.max(s.totalSquadKills, s.totalEnemyDeaths)} color="bg-slate-500" />
          </div>
        </Panel>
      </div>

      {/* Per-fight KDR */}
      <Panel title="Fight-by-Fight Outcome" icon={<Crosshair className="w-4 h-4" />} accent="text-sky-400">
        <div className="flex flex-wrap gap-1.5">
          {s.fightBreakdown.map((f, i) => (
            <div
              key={f.id}
              title={`${f.label} - ${f.mapName} (${f.duration}) - ${f.isWin ? "Win" : "Loss"}`}
              className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold font-mono cursor-default transition-transform hover:scale-110 ${
                f.isWin
                  ? "bg-emerald-600/30 text-emerald-400 border border-emerald-500/40"
                  : "bg-rose-600/30 text-rose-400 border border-rose-500/40"
              }`}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[10px] font-mono text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-600/40 border border-emerald-500/40" /> Win ({s.wins})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-rose-600/40 border border-rose-500/40" /> Loss ({s.losses})
          </span>
        </div>
      </Panel>
    </div>
  );
}

function KdrBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-[11px] font-mono mb-1.5">
        <span className="text-slate-400 font-semibold">{label}</span>
        <span className="text-slate-200 font-bold">{fmtNum(value)}</span>
      </div>
      <div className="h-2 w-full bg-slate-800/60 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
