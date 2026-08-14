import { useState } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import StatCard from "../components/ui/StatCard";
import { fmtNum, fmtDur, profChip, profStyle } from "../utils/format";
import { Users, Clock, Heart, Eye } from "lucide-react";
import ProfessionIcon from "../components/ui/ProfessionIcon";

type SortKey = "account" | "characters" | "classes" | "combat" | "squad" | "uptime";
type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

export default function RosterView() {
  const { report } = useReport();
  // Default matches the previous hard-coded ordering so nothing shifts on load.
  const [sort, setSort] = useState<SortState>(null);
  if (!report) return null;
  const s = report.stats;
  const attendance = s.attendanceData;

  const totalCombatMs = attendance.reduce((a, p) => a + p.combatTimeMs, 0);
  const avgCombatMs = attendance.length ? totalCombatMs / attendance.length : 0;
  const fullAtt = attendance.filter((p) => p.combatTimeMs / p.squadTimeMs > 0.9).length;

  const uptimeOf = (p: (typeof attendance)[number]) =>
    p.squadTimeMs > 0 ? p.combatTimeMs / p.squadTimeMs : 0;

  // Plain computation rather than useMemo: this sits after the `if (!report)`
  // early return, so a hook here would change hook order between renders.
  // A roster is tens of rows; re-sorting per render is free.
  const sorted = (() => {
    const activeSort = sort ?? { key: "combat" as const, dir: "desc" as const };
    const dir = activeSort.dir === "asc" ? 1 : -1;
    // Text columns sort alphabetically; numeric columns numerically. localeCompare
    // keeps non-ASCII account/character names in a sane order.
    const cmp: Record<SortKey, (a: typeof attendance[number], b: typeof attendance[number]) => number> = {
      account: (a, b) => a.account.localeCompare(b.account),
      characters: (a, b) => (a.characterNames[0] ?? "").localeCompare(b.characterNames[0] ?? ""),
      classes: (a, b) =>
        (a.classTimes[0]?.profession ?? "").localeCompare(b.classTimes[0]?.profession ?? ""),
      combat: (a, b) => a.combatTimeMs - b.combatTimeMs,
      squad: (a, b) => a.squadTimeMs - b.squadTimeMs,
      uptime: (a, b) => uptimeOf(a) - uptimeOf(b),
    };
    return [...attendance].sort((a, b) => cmp[activeSort.key](a, b) * dir || a.account.localeCompare(b.account));
  })();

  const partyGroups = (() => {
    const groups = new Map<number, typeof attendance>();
    attendance.forEach((p) => {
      const group = Number.isFinite(Number(p.group)) && Number(p.group) > 0 ? Number(p.group) : 0;
      const list = groups.get(group) ?? [];
      list.push(p);
      groups.set(group, list);
    });
    return Array.from(groups.entries())
      .sort(([a], [b]) => (a === 0 ? 1 : b === 0 ? -1 : a - b))
      .map(([group, players]) => ({
        group,
        players: [...players].sort((a, b) => {
          const profA = a.classTimes[0]?.profession ?? "";
          const profB = b.classTimes[0]?.profession ?? "";
          return profA.localeCompare(profB) || a.account.localeCompare(b.account);
        }),
      }));
  })();

  const toggleSort = (key: SortKey) =>
    setSort((prev) =>
      prev?.key === key
        ? prev.dir === "desc"
          ? { key, dir: "asc" }
          : null
        : // Numeric columns are most useful largest-first on their first click.
          { key, dir: key === "account" || key === "characters" || key === "classes" ? "asc" : "desc" },
    );

  const SortHeader = ({ label, k, align = "left", width }: { label: string; k: SortKey; align?: "left" | "right"; width?: string }) => (
    <th className={`p-2.5 ${align === "right" ? "text-right" : ""} ${width ?? ""}`}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-slate-300 ${
          sort?.key === k ? "text-sky-400" : ""
        }`}
      >
        {label}
        <span className="text-[8px] opacity-70">{sort?.key === k ? (sort.dir === "asc" ? "ASC" : "DESC") : "SORT"}</span>
      </button>
    </th>
  );

  const PlayerClassChip = ({ profession }: { profession: string }) => (
    <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(profession)}`}>
      <ProfessionIcon profession={profession} className="h-3.5 w-3.5 shrink-0" />
      {profession}
    </span>
  );

  return (
    <div className="space-y-5 animate-view pb-12">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Roster Size" value={fmtNum(attendance.length)} icon={<Users className="w-3.5 h-3.5 text-sky-400" />} accent="text-sky-400" />
        <StatCard label="Avg Combat Time" value={fmtDur(avgCombatMs)} icon={<Clock className="w-3.5 h-3.5 text-emerald-400" />} accent="text-emerald-400" />
        <StatCard label="Full Attendance" value={fullAtt} icon={<Heart className="w-3.5 h-3.5 text-rose-400" />} accent="text-rose-400" sub=">90% combat uptime" />
        <StatCard label="Total Fights" value={fmtNum(s.total)} icon={<Eye className="w-3.5 h-3.5 text-cyan-400" />} accent="text-cyan-400" />
      </div>

      <Panel
        title="Raid Parties"
        subtitle="Roster grouped by the in-game subgroup each player spent the most active time in."
        icon={<Users className="w-4 h-4" />}
        accent="text-sky-400"
        action={`${partyGroups.length} groups`}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {partyGroups.map(({ group, players }) => (
            <div key={group || "unknown"} className="rounded-xl border border-slate-800/70 bg-slate-950/35 p-3">
              <div className="mb-3 flex items-center justify-between border-b border-slate-800/50 pb-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  {group > 0 ? `Party ${group}` : "Unassigned"}
                </div>
                <div className="rounded-md border border-slate-700/70 bg-slate-900/80 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                  {players.length}
                </div>
              </div>
              <div className="space-y-2">
                {players.map((p) => {
                  const uptime = uptimeOf(p) * 100;
                  const mainProf = p.classTimes[0]?.profession ?? "Unknown";
                  const st = profStyle(mainProf);
                  return (
                    <div key={p.account} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[11px] font-semibold text-slate-200">{p.account}</div>
                          <div className="truncate text-[10px] text-slate-500">{p.characterNames[0] ?? "No character name"}</div>
                        </div>
                        <PlayerClassChip profession={mainProf} />
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800/60">
                          <div className={`h-full rounded-full ${st.dot}`} style={{ width: `${Math.min(100, Math.max(0, uptime))}%` }} />
                        </div>
                        <span className="w-9 text-right font-mono text-[10px] font-bold text-slate-400">{uptime.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Roster table */}
      <Panel title="Roster Intel" icon={<Users className="w-4 h-4" />} accent="text-sky-400" action={`${attendance.length} PLAYERS`} bodyClassName="p-0">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/50">
                <SortHeader label="Player" k="account" />
                <SortHeader label="Characters" k="characters" />
                <SortHeader label="Classes Played" k="classes" />
                <SortHeader label="Combat Time" k="combat" align="right" />
                <SortHeader label="Squad Time" k="squad" align="right" />
                <SortHeader label="Uptime" k="uptime" width="w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30 font-mono">
              {sorted.map((p) => {
                  const uptime = p.squadTimeMs > 0 ? (p.combatTimeMs / p.squadTimeMs) * 100 : 0;
                  const mainProf = p.classTimes[0]?.profession ?? "Unknown";
                  const st = profStyle(mainProf);
                  return (
                    <tr key={p.account} className="hover:bg-blue-950/20 transition-colors">
                      <td className="p-2.5 text-slate-200 font-semibold whitespace-nowrap">{p.account}</td>
                      <td className="p-2.5 text-slate-400">{p.characterNames.join(", ") || "-"}</td>
                      <td className="p-2.5">
                        <div className="flex flex-wrap gap-1">
                          {p.classTimes.slice(0, 3).map((c) => (
                            <PlayerClassChip key={c.profession} profession={c.profession} />
                          ))}
                          {p.classTimes.length > 3 && (
                            <span className="text-[10px] text-slate-500">+{p.classTimes.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5 text-right text-slate-300">{fmtDur(p.combatTimeMs)}</td>
                      <td className="p-2.5 text-right text-slate-500">{fmtDur(p.squadTimeMs)}</td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 bg-slate-800/60 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${st.dot}`}
                              style={{ width: `${uptime}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-bold w-10 text-right ${uptime > 80 ? "text-emerald-400" : uptime > 50 ? "text-amber-400" : "text-rose-400"}`}>
                            {uptime.toFixed(0)}%
                          </span>
                        </div>
                      </td>
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
