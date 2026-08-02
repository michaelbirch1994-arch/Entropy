import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import { fmtNum } from "../utils/format";
import { LineChart as LineChartIcon } from "lucide-react";

const PLAYER_COLORS = ["#f59e0b", "#38bdf8", "#f43f5e", "#34d399", "#a78bfa", "#fb923c", "#22d3ee", "#e879f9"];

function fmtClock(sec: number): string {
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
}

export default function DpsGraphView() {
  const { report } = useReport();
  const data = report?.stats.dpsGraph;
  const [fightIdx, setFightIdx] = useState(0);
  const [compareAccounts, setCompareAccounts] = useState<string[]>([]);

  const fight = data?.fights[fightIdx];

  const chartData = useMemo(() => {
    if (!fight) return [];
    const len = fight.squad.length;
    const compared = fight.players.filter((p) => compareAccounts.includes(p.account));
    const rows: Record<string, number>[] = [];
    for (let i = 0; i < len; i++) {
      const row: Record<string, number> = { t: i, squad: fight.squad[i] };
      compared.forEach((p) => { row[p.account] = i < p.points.length ? p.points[i] : p.points[p.points.length - 1] ?? 0; });
      rows.push(row);
    }
    return rows;
  }, [fight, compareAccounts]);

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
            onChange={(e) => { setFightIdx(Number(e.target.value)); setCompareAccounts([]); }}
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
          title="Cumulative Damage Over Time"
          subtitle="Squad total damage across the fight - select players below to compare their individual lines"
          icon={<LineChartIcon className="w-3.5 h-3.5" />}
          action={`peak ${fmtNum(fight.squad[fight.squad.length - 1] ?? 0)}`}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="t" tickFormatter={fmtClock} stroke="#475569" fontSize={10} />
                <YAxis tickFormatter={(v) => fmtNum(v)} stroke="#475569" fontSize={10} width={56} />
                <Tooltip
                  labelFormatter={(v) => `t=${fmtClock(Number(v))}`}
                  formatter={(v, name) => [fmtNum(Number(v)), name === "squad" ? "Squad" : String(name)]}
                  contentStyle={{ background: "#0a0e1f", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, fontSize: 11 }}
                />
                {compareAccounts.length > 0 && <Legend wrapperStyle={{ fontSize: 10 }} />}
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
    </div>
  );
}
