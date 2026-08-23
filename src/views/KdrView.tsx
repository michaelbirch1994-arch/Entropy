import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import StatCard from "../components/ui/StatCard";
import { fmtNum, fmtFixed } from "../utils/format";
import { Swords, Skull, Crosshair, Users, TrendingUp, Activity } from "lucide-react";
import type { FightRow } from "../types/report";
import { fightOutcomeLabel, fightOutcomeMarkerClass, fightOutcomeSortValue, fightOutcomeTextClass } from "../utils/fightOutcome";

type SortKey = "fight" | "outcome" | "kills" | "downs" | "deaths" | "trade" | "squad" | "enemies";
type SortState = { key: SortKey; dir: "desc" | "asc" } | null;

function tradeRatio(kills: number, deaths: number) {
  if (deaths > 0) return kills / deaths;
  return kills > 0 ? Infinity : 0;
}

function compareNumber(a: number, b: number, dir: "desc" | "asc") {
  const av = Number.isFinite(a) ? a : Number.MAX_SAFE_INTEGER;
  const bv = Number.isFinite(b) ? b : Number.MAX_SAFE_INTEGER;
  return dir === "desc" ? bv - av : av - bv;
}

export default function KdrView() {
  const { report } = useReport();
  const [sort, setSort] = useState<SortState>(null);
  const s = report?.stats;
  const fightRows = s?.fightBreakdown ?? [];

  const sortedFights = useMemo(() => {
    const base = fightRows.map((fight, index) => ({ fight, index }));
    if (!sort) return base;
    const valueFor = (row: { fight: FightRow; index: number }) => {
      const f = row.fight;
      switch (sort.key) {
        case "fight": return row.index + 1;
        case "outcome": return fightOutcomeSortValue(f.isWin);
        case "kills": return f.enemyDeaths;
        case "downs": return f.enemyDowns;
        case "deaths": return f.alliesDead;
        case "trade": return tradeRatio(f.enemyDeaths, f.alliesDead);
        case "squad": return f.squadCount;
        case "enemies": return f.enemyCount;
        default: return row.index;
      }
    };
    return [...base].sort((a, b) => compareNumber(valueFor(a), valueFor(b), sort.dir) || a.index - b.index);
  }, [fightRows, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, dir: "desc" };
      if (current.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  };

  const SortHeader = ({ k, children, className = "" }: { k: SortKey; children: ReactNode; className?: string }) => {
    const active = sort?.key === k;
    const glyph = active ? (sort.dir === "desc" ? "▼" : "▲") : "↕";
    return (
      <th className={`p-2.5 font-medium ${className}`}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 transition-colors ${active ? "text-theme-accent-strong" : "text-theme-muted hover:text-theme-text"}`}
        >
          {children}
          <span className="text-[8px] opacity-70">{glyph}</span>
        </button>
      </th>
    );
  };

  if (!s) return null;

  const squadKdr = tradeRatio(s.totalSquadKills, s.totalSquadDeaths);
  const tradeDelta = s.totalSquadKills - s.totalSquadDeaths;
  const deathsPerFight = s.total > 0 ? s.totalSquadDeaths / s.total : 0;
  const classifiedFights = s.wins + s.losses;
  const unclassifiedFights = s.unclassified ?? Math.max(0, s.total - classifiedFights);
  const winRate = classifiedFights > 0 ? (s.wins / classifiedFights) * 100 : null;

  return (
    <div className="space-y-6 animate-view pb-12">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Our KDR"
          value={fmtFixed(squadKdr, 2)}
          icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
          accent="text-emerald-400"
          sub={`${fmtNum(s.totalSquadKills)} enemy kills / ${fmtNum(s.totalSquadDeaths)} allied deaths`}
        />
        <StatCard
          label="Trade Difference"
          value={`${tradeDelta >= 0 ? "+" : ""}${fmtNum(tradeDelta)}`}
          icon={<Activity className="w-3.5 h-3.5 text-amber-400" />}
          accent={tradeDelta >= 0 ? "text-amber-400" : "text-rose-400"}
          sub={`${fmtNum(s.totalSquadKills)} enemy deaths minus ${fmtNum(s.totalSquadDeaths)} allied deaths`}
        />
        <StatCard
          label="Deaths / Fight"
          value={fmtFixed(deathsPerFight, 1)}
          icon={<Skull className="w-3.5 h-3.5 text-rose-400" />}
          accent="text-rose-400"
          sub={`${fmtNum(s.totalSquadDeaths)} allied deaths across ${fmtNum(s.total)} fights`}
        />
        <StatCard
          label="Classified Win Rate"
          value={winRate == null ? "—" : `${fmtFixed(winRate, 1)}%`}
          icon={<Swords className="w-3.5 h-3.5 text-emerald-400" />}
          accent="text-emerald-400"
          sub={classifiedFights > 0 ? `${s.wins}W / ${s.losses}L · ${unclassifiedFights} unclassified` : `${unclassifiedFights} fights · outcome unavailable`}
        />
        <StatCard
          label="Avg Squad Size"
          value={fmtFixed(s.avgSquadSize, 0)}
          icon={<Users className="w-3.5 h-3.5 text-amber-400" />}
          accent="text-amber-400"
          sub={`vs ${fmtFixed(s.avgEnemies, 0)} enemies`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Squad Trade Record" subtitle="Canonical KDR: enemy deaths credited by squad divided by allied deaths." icon={<Swords className="w-4 h-4" />}>
          <div className="space-y-4">
            <KdrBar label="Enemy deaths" value={s.totalSquadKills} max={Math.max(s.totalSquadKills, s.totalSquadDeaths)} color="bg-emerald-500" />
            <KdrBar label="Enemy downs" value={s.totalSquadDowns} max={Math.max(s.totalSquadDowns, s.totalEnemyDowns)} color="bg-amber-500" />
            <KdrBar label="Allied deaths" value={s.totalSquadDeaths} max={Math.max(s.totalSquadKills, s.totalSquadDeaths)} color="bg-rose-500" />
          </div>
        </Panel>

        <Panel title="Pressure Against Squad" subtitle="This is not a second KDR formula; it shows the enemy pressure that produced allied downs and deaths." icon={<Skull className="w-4 h-4" />} tone="danger">
          <div className="space-y-4">
            <KdrBar label="Allied deaths" value={s.totalSquadDeaths} max={Math.max(s.totalSquadKills, s.totalSquadDeaths)} color="bg-rose-500" />
            <KdrBar label="Allied downs" value={s.totalEnemyDowns} max={Math.max(s.totalSquadDowns, s.totalEnemyDowns)} color="bg-orange-500" />
            <KdrBar label="Enemy deaths" value={s.totalSquadKills} max={Math.max(s.totalSquadKills, s.totalSquadDeaths)} color="bg-slate-500" />
          </div>
        </Panel>
      </div>

      <Panel title="Fight-by-Fight Outcome" icon={<Crosshair className="w-4 h-4" />}>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {s.fightBreakdown.map((f, i) => (
            <div
              key={f.id}
              title={`${f.label} - ${f.mapName} (${f.duration}) - ${fightOutcomeLabel(f.isWin)} - ${f.enemyDeaths}/${f.alliesDead} trade`}
              className={`w-7 h-7 rounded-md flex items-center justify-center border text-[10px] font-bold font-mono cursor-default transition-transform hover:scale-110 ${fightOutcomeMarkerClass(f.isWin)}`}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <div className="overflow-x-auto custom-scrollbar rounded-xl border border-theme-border/70 bg-theme-surface-inset/45">
          <table className="w-full min-w-[760px] text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="text-[10px] text-theme-muted uppercase font-bold tracking-wider border-b border-theme-border/50 bg-theme-surface-inset/70">
                <SortHeader k="fight">Fight</SortHeader>
                <th className="p-2.5 font-medium">Map</th>
                <th className="p-2.5 font-medium">Duration</th>
                <SortHeader k="outcome">Outcome</SortHeader>
                <SortHeader k="squad" className="text-right">Squad</SortHeader>
                <SortHeader k="enemies" className="text-right">Enemies</SortHeader>
                <SortHeader k="kills" className="text-right">Enemy Deaths</SortHeader>
                <SortHeader k="downs" className="text-right">Enemy Downs</SortHeader>
                <SortHeader k="deaths" className="text-right">Allied Deaths</SortHeader>
                <SortHeader k="trade" className="text-right">Trade</SortHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border/30 font-mono">
              {sortedFights.map(({ fight: f, index }) => (
                <tr key={f.id} className="transition-colors hover:bg-theme-surface-elevated/55">
                  <td className="p-2.5 text-theme-muted">F{index + 1}</td>
                  <td className="p-2.5 text-theme-text/85 font-semibold">{f.mapName}</td>
                  <td className="p-2.5 text-theme-muted">{f.duration}</td>
                  <td className={`p-2.5 font-bold ${fightOutcomeTextClass(f.isWin)}`}>{fightOutcomeLabel(f.isWin)}</td>
                  <td className="p-2.5 text-right text-theme-text/80">{fmtNum(f.squadCount)}</td>
                  <td className="p-2.5 text-right text-theme-text/80">{fmtNum(f.enemyCount)}</td>
                  <td className="p-2.5 text-right text-emerald-400">{fmtNum(f.enemyDeaths)}</td>
                  <td className="p-2.5 text-right text-amber-300">{fmtNum(f.enemyDowns)}</td>
                  <td className="p-2.5 text-right text-rose-400">{fmtNum(f.alliesDead)}</td>
                  <td className="p-2.5 text-right text-amber-300 font-bold">{fmtFixed(tradeRatio(f.enemyDeaths, f.alliesDead), 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-4 text-[10px] font-mono text-theme-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-600/40 border border-emerald-500/40" /> Win ({s.wins})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-rose-600/40 border border-rose-500/40" /> Loss ({s.losses})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-theme-surface-elevated border border-theme-border" /> Unclassified ({unclassifiedFights})
          </span>
          <span>Sorted columns follow: descending, ascending, default.</span>
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
        <span className="text-theme-muted font-semibold">{label}</span>
        <span className="text-theme-text font-bold">{fmtNum(value)}</span>
      </div>
      <div className="h-2 w-full bg-theme-surface-inset rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
