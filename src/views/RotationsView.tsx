import { useMemo, useState } from "react";
import { useReport } from "../store/ReportContext";
import { profChip } from "../utils/format";
import Panel from "../components/ui/Panel";
import StatCard from "../components/ui/StatCard";
import { Activity, Clock, Repeat2, Search } from "lucide-react";

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

// Deterministic-ish hue per skill id so casts are visually distinguishable
// without a fixed palette (squad rotations can reference hundreds of skills).
function skillColor(id: number): string {
  const hue = (id * 47) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

export default function RotationsView() {
  const { report } = useReport();
  const data = report?.stats.rotations;
  const [fightIdx, setFightIdx] = useState(0);
  const [playerAccount, setPlayerAccount] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fight = data?.fights[fightIdx];

  // Squad-wide rows, filtered by the search box. Sorted by profession then
  // account so classes cluster together the way dps.report's rotation view
  // groups them - much easier to scan than raw squad order.
  const rows = useMemo(() => {
    if (!fight) return [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? fight.players.filter((p) => p.account.toLowerCase().includes(q) || p.profession.toLowerCase().includes(q))
      : fight.players;
    return [...filtered].sort(
      (a, b) => a.profession.localeCompare(b.profession) || a.account.localeCompare(b.account)
    );
  }, [fight, search]);

  const activeAccount = useMemo(() => {
    if (!fight) return null;
    if (playerAccount && fight.players.some((p) => p.account === playerAccount)) return playerAccount;
    return fight.players[0]?.account ?? null;
  }, [fight, playerAccount]);

  const activePlayer = fight?.players.find((p) => p.account === activeAccount);
  const activeMinutes = fight ? Math.max(fight.durationMs / 60000, 1 / 60) : 1;
  const castCount = activePlayer?.casts.length ?? 0;
  const castRate = castCount / activeMinutes;
  const uniqueSkills = new Set(activePlayer?.casts.map((cast) => cast.skillId) ?? []).size;
  const mostUsedSkill = useMemo(() => {
    if (!activePlayer || !data) return null;
    const counts = new Map<number, number>();
    activePlayer.casts.forEach((cast) => counts.set(cast.skillId, (counts.get(cast.skillId) ?? 0) + 1));
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    return top ? { name: data.skillMeta[top[0]]?.name ?? `Skill ${top[0]}`, count: top[1] } : null;
  }, [activePlayer, data]);

  if (!report) return null;

  if (!data || data.fights.length === 0) {
    return (
      <div className="space-y-5 animate-view pb-12">
        <Panel
          title="Rotations"
          icon={<Clock className="w-3.5 h-3.5" />}
          empty={
            <div className="py-10 text-center text-sm text-slate-500">
              No skill-cast timeline data available for this report.
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

  return (
    <div className="space-y-5 animate-view pb-12">
      <div className="flex flex-wrap items-center gap-3">
        {data.fights.length > 1 && (
          <select
            value={fightIdx}
            onChange={(e) => { setFightIdx(Number(e.target.value)); setPlayerAccount(null); }}
            className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2"
          >
            {data.fights.map((f, i) => (
              <option key={f.fightId} value={i}>{f.fightName} ({fmtClock(f.durationMs)})</option>
            ))}
          </select>
        )}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by player or class..."
            className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg pl-8 pr-3 py-2"
          />
        </div>
      </div>

      {/* Stacked squad-wide timeline - every player's casts on their own row,
          all sharing the same time axis. Mirrors dps.report's rotation view. */}
      {fight && rows.length > 0 && (
        <Panel
          title="Squad Rotation"
          subtitle={`${rows.length} players over ${fmtClock(fight.durationMs)} - click a row for the full cast list`}
          icon={<Clock className="w-3.5 h-3.5" />}
          bodyClassName="p-0"
        >
          <div className="max-h-[520px] overflow-y-auto custom-scrollbar">
            {rows.map((p) => {
              const isActive = p.account === activeAccount;
              return (
                <button
                  key={p.account}
                  onClick={() => setPlayerAccount(p.account)}
                  className={`w-full flex items-stretch gap-2 px-3 py-1 border-b border-slate-800/40 text-left transition-colors ${
                    isActive ? "bg-amber-500/10" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="w-40 flex-shrink-0 flex flex-col justify-center py-0.5">
                    <span className={`truncate text-[11px] font-semibold ${isActive ? "text-amber-300" : "text-slate-300"}`}>
                      {p.account}
                    </span>
                    <span className={`px-1 py-0 rounded text-[9px] font-bold border w-fit ${profChip(p.profession)}`}>
                      {p.profession}
                    </span>
                  </div>
                  <div className="relative flex-1 bg-black/30 rounded-md my-1 h-6 overflow-hidden">
                    {p.casts.map((c, i) => {
                      const left = (c.castTime / fight.durationMs) * 100;
                      const width = Math.max((Math.max(c.duration, 150) / fight.durationMs) * 100, 0.25);
                      const meta = data.skillMeta[c.skillId];
                      return (
                        <div
                          key={i}
                          title={`${meta?.name ?? `Skill ${c.skillId}`} @ ${fmtClock(c.castTime)}`}
                          className="absolute top-0.5 bottom-0.5 rounded-sm"
                          style={{ left: `${left}%`, width: `${width}%`, backgroundColor: skillColor(c.skillId) }}
                        />
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono px-3 py-2 border-t border-slate-800/40">
            <span>0:00</span>
            <span>{fmtClock(fight.durationMs)}</span>
          </div>
        </Panel>
      )}

      {fight && activePlayer && (
        <div className="theme-stat-grid grid gap-3 md:grid-cols-3">
          <StatCard label="Parsed casts / minute" value={castRate.toFixed(1)} icon={<Activity className="h-3.5 w-3.5 text-orange-400" />} accent="text-orange-300" sub="All casts present in the EI rotation timeline" />
          <StatCard label="Unique skills" value={uniqueSkills} icon={<Repeat2 className="h-3.5 w-3.5 text-cyan-400" />} accent="text-cyan-300" sub={`${castCount} parsed casts in selected fight`} />
          <StatCard label="Most-used skill" value={mostUsedSkill?.count ?? 0} icon={<Clock className="h-3.5 w-3.5 text-amber-400" />} accent="text-amber-300" sub={mostUsedSkill?.name ?? "No parsed casts"} />
        </div>
      )}

      {fight && activePlayer && (
        <Panel
          title="Skill Rotation"
          subtitle={`${activePlayer.account} - ${activePlayer.casts.length} casts over ${fmtClock(fight.durationMs)}`}
          icon={<Clock className="w-3.5 h-3.5" />}
          action={
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(activePlayer.profession)}`}>
              {activePlayer.profession}
            </span>
          }
        >
          <div className="relative bg-black/30 rounded-xl border border-slate-800 h-16 overflow-hidden">
            {activePlayer.casts.map((c, i) => {
              const left = (c.castTime / fight.durationMs) * 100;
              const width = Math.max((Math.max(c.duration, 150) / fight.durationMs) * 100, 0.3);
              const meta = data.skillMeta[c.skillId];
              return (
                <div
                  key={i}
                  title={`${meta?.name ?? `Skill ${c.skillId}`} @ ${fmtClock(c.castTime)}`}
                  className="absolute top-2 bottom-2 rounded-sm hover:ring-1 hover:ring-white/60 transition-all cursor-default"
                  style={{ left: `${left}%`, width: `${width}%`, backgroundColor: skillColor(c.skillId) }}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1.5">
            <span>0:00</span>
            <span>{fmtClock(fight.durationMs)}</span>
          </div>

          <div className="mt-5 max-h-72 overflow-y-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-amber-500/10 text-[10px] uppercase tracking-wider text-slate-500 sticky top-0 bg-[#0a0e1f]">
                  <th className="text-left font-bold px-3 py-2">Time</th>
                  <th className="text-left font-bold px-3 py-2">Skill</th>
                </tr>
              </thead>
              <tbody>
                {activePlayer.casts.map((c, i) => {
                  const meta = data.skillMeta[c.skillId];
                  return (
                    <tr key={i} className="border-b border-slate-800/30 hover:bg-white/[0.02]">
                      <td className="px-3 py-1.5 font-mono text-slate-500">{fmtClock(c.castTime)}</td>
                      <td className="px-3 py-1.5 flex items-center gap-2">
                        {meta?.icon && <img src={meta.icon} alt="" referrerPolicy="no-referrer" className="w-4 h-4 rounded-sm" loading="lazy" />}
                        <span className="text-slate-300 font-medium">{meta?.name ?? `Skill ${c.skillId}`}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
