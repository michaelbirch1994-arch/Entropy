import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import { fmtNum } from "../utils/format";
import { LineChart as LineChartIcon, Swords, MousePointerClick } from "lucide-react";

const PLAYER_COLORS = ["#f59e0b", "#38bdf8", "#f43f5e", "#34d399", "#a78bfa", "#fb923c", "#22d3ee", "#e879f9"];

function fmtClock(sec: number): string {
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
}

// How far either side of a clicked point (in seconds) to pull skill casts
// from - wide enough to catch a burst rotation's several skills landing
// within the same second or two of each other, narrow enough that it stays
// "what happened at this spike" rather than "what happened all fight".
const SPIKE_WINDOW_SEC = 3;

export default function DpsGraphView() {
  const { report } = useReport();
  const data = report?.stats.dpsGraph;
  const [fightIdx, setFightIdx] = useState(0);
  const [compareAccounts, setCompareAccounts] = useState<string[]>([]);
  const [selectedT, setSelectedT] = useState<number | null>(null);

  const fight = data?.fights[fightIdx];

  // Underlying data is cumulative damage per second (a running total), which
  // only ever goes up and to the right - not useful for spotting when DPS
  // actually spiked or dropped. Convert to instantaneous DPS via a rolling
  // window diff instead: rate at second i = damage gained over the last
  // WINDOW_SEC seconds, divided by however much of that window has elapsed.
  const WINDOW_SEC = 5;
  const toDpsSeries = (points: number[]): number[] =>
    points.map((_, i) => {
      const start = Math.max(0, i - WINDOW_SEC);
      const span = i - start;
      if (span <= 0) return 0;
      return (points[i] - points[start]) / span;
    });

  const chartData = useMemo(() => {
    if (!fight) return [];
    const len = fight.squad.length;
    const compared = fight.players.filter((p) => compareAccounts.includes(p.account));
    const squadDps = toDpsSeries(fight.squad);
    const comparedDps = compared.map((p) => ({ account: p.account, dps: toDpsSeries(p.points) }));
    const rows: Record<string, number>[] = [];
    for (let i = 0; i < len; i++) {
      const row: Record<string, number> = { t: i, squad: squadDps[i] ?? 0 };
      comparedDps.forEach(({ account, dps }) => { row[account] = i < dps.length ? dps[i] : dps[dps.length - 1] ?? 0; });
      rows.push(row);
    }
    return rows;
  }, [fight, compareAccounts]);

  // Skills cast within SPIKE_WINDOW_SEC of the clicked point, across the
  // whole squad, tallied by skill and sorted by how often it went off - the
  // "what actually happened here" answer to a spike on the graph. Rotation
  // cast timestamps are the real per-skill timing data available (EI doesn't
  // timestamp individual damage ticks), so this shows *what was cast* during
  // the spike rather than claiming an exact damage-per-skill split.
  const rotationFight = report?.stats.rotations?.fights.find((rf) => rf.fightId === fight?.fightId);
  const skillMeta = report?.stats.rotations?.skillMeta ?? {};
  const spikeBreakdown = useMemo(() => {
    if (selectedT == null || !rotationFight) return null;
    const windowMs = SPIKE_WINDOW_SEC * 1000;
    const centerMs = selectedT * 1000;
    const tally = new Map<number, { count: number; players: Set<string> }>();
    rotationFight.players.forEach((p) => {
      p.casts.forEach((c) => {
        if (Math.abs(c.castTime - centerMs) <= windowMs) {
          const entry = tally.get(c.skillId) ?? { count: 0, players: new Set<string>() };
          entry.count++;
          entry.players.add(p.account);
          tally.set(c.skillId, entry);
        }
      });
    });
    return Array.from(tally.entries())
      .map(([id, v]) => ({
        id,
        name: skillMeta[id]?.name ?? `Skill ${id}`,
        icon: skillMeta[id]?.icon,
        count: v.count,
        playerCount: v.players.size,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [selectedT, rotationFight, skillMeta]);

  if (!report) return null;

  if (!data || data.fights.length === 0) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel
          title="DPS Graph"
          icon={<LineChartIcon className="w-3.5 h-3.5" />}
          empty={
            <div className="py-10 text-center text-sm text-slate-500">
              No damage-over-time data available for this report.
              <p className="text-[11px] text-slate-500 mt-1">
                Only populated for reports built from raw dps.report / .zevtc imports.
              </p>
            </div>
          }
        >
          {null}
        </Panel>
      </div>
    );
  }

  function toggleCompare(account: string) {
    setCompareAccounts((prev) =>
      prev.includes(account) ? prev.filter((a) => a !== account) : prev.length >= PLAYER_COLORS.length ? prev : [...prev, account],
    );
  }

  return (
    <div className="space-y-5 animate-view pb-12">
      <div className="flex flex-wrap items-center gap-3">
        {data.fights.length > 1 && (
          <select
            value={fightIdx}
            onChange={(e) => { setFightIdx(Number(e.target.value)); setCompareAccounts([]); setSelectedT(null); }}
            className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2"
          >
            {data.fights.map((f, i) => (
              <option key={f.fightId} value={i}>{f.fightName}</option>
            ))}
          </select>
        )}
      </div>

      {fight && (
        <Panel
          title="DPS Over Time"
          subtitle={`Squad DPS across the fight (${WINDOW_SEC}s rolling window) - click a point on the graph to see what skills the squad was casting right then`}
          icon={<LineChartIcon className="w-3.5 h-3.5" />}
          action={`peak ${fmtNum(Math.max(0, ...chartData.map((r) => r.squad ?? 0)))} dps`}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
                onClick={(e) => { if (e && e.activeLabel != null) setSelectedT(Number(e.activeLabel)); }}
                className="cursor-pointer"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="t" tickFormatter={fmtClock} stroke="#475569" fontSize={10} />
                <YAxis tickFormatter={(v) => fmtNum(v)} stroke="#475569" fontSize={10} width={56} />
                <Tooltip
                  labelFormatter={(v) => `t=${fmtClock(Number(v))}`}
                  formatter={(v, name) => [fmtNum(Number(v)), name === "squad" ? "Squad" : String(name)]}
                  contentStyle={{ background: "#0a0e1f", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, fontSize: 11 }}
                />
                {compareAccounts.length > 0 && <Legend wrapperStyle={{ fontSize: 10 }} />}
                {selectedT != null && <ReferenceLine x={selectedT} stroke="#38bdf8" strokeDasharray="4 4" />}
                <Line type="monotone" dataKey="squad" name="Squad" stroke="#f59e0b" strokeWidth={2} dot={false} />
                {compareAccounts.map((acc, i) => (
                  <Line
                    key={acc}
                    type="monotone"
                    dataKey={acc}
                    name={acc}
                    stroke={PLAYER_COLORS[i % PLAYER_COLORS.length]}
                    strokeWidth={1.5}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-4">
            {fight.players
              .slice()
              .sort((a, b) => (b.points[b.points.length - 1] ?? 0) - (a.points[a.points.length - 1] ?? 0))
              .map((p) => {
                const active = compareAccounts.includes(p.account);
                return (
                  <button
                    key={p.account}
                    onClick={() => toggleCompare(p.account)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                      active
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                        : "bg-white/[0.02] border-white/[0.06] text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {p.account}
                  </button>
                );
              })}
          </div>
        </Panel>
      )}

      {fight && (
        <Panel
          title="Spike Breakdown"
          subtitle={
            selectedT != null
              ? `Skills cast squad-wide within ${SPIKE_WINDOW_SEC}s of t=${fmtClock(selectedT)}`
              : "Click any point on the DPS graph above to see what the squad was casting at that moment"
          }
          icon={<Swords className="w-3.5 h-3.5" />}
          accent="text-rose-400"
        >
          {!rotationFight ? (
            <div className="py-6 text-center text-sm text-slate-500">
              No rotation/cast-timeline data available for this fight to break spikes down by skill.
            </div>
          ) : selectedT == null ? (
            <div className="py-6 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
              <MousePointerClick className="w-5 h-5 text-slate-600" />
              Click a point on the graph above.
            </div>
          ) : !spikeBreakdown || spikeBreakdown.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">No skill casts recorded in that window.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {spikeBreakdown.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                  {s.icon ? (
                    <img src={s.icon} alt="" referrerPolicy="no-referrer" className="w-6 h-6 rounded flex-shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded bg-slate-800 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-200 truncate">{s.name}</div>
                    <div className="text-[10px] font-mono text-slate-500">
                      {s.count}x - {s.playerCount} player{s.playerCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
