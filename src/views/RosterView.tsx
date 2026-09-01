import { useState } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import StatCard from "../components/ui/StatCard";
import { fmtNum, fmtDur, profStyle } from "../utils/format";
import { Users, Clock, Heart, Eye } from "lucide-react";
import ProfessionIdentity from "../components/ui/ProfessionIdentity";
import { SortableHeader } from "../components/ui/SortableHeader";

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

  const PlayerClassChip = ({ profession }: { profession: string }) => (
    <ProfessionIdentity profession={profession} />
  );

  return (
    <div className="theme-view-layout space-y-5 animate-view pb-12">
      {/* Summary */}
      <div className="theme-stat-grid grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Roster Size" value={fmtNum(attendance.length)} icon={<Users className="w-3.5 h-3.5 text-theme-accent" />} accent="text-theme-accent" />
        <StatCard label="Avg Combat Time" value={fmtDur(avgCombatMs)} icon={<Clock className="w-3.5 h-3.5 text-emerald-400" />} accent="text-emerald-400" />
        <StatCard label="Full Attendance" value={fullAtt} icon={<Heart className="w-3.5 h-3.5 text-rose-400" />} accent="text-rose-400" sub=">90% combat uptime" />
        <StatCard label="Total Fights" value={fmtNum(s.total)} icon={<Eye className="w-3.5 h-3.5 text-amber-400" />} accent="text-amber-400" />
      </div>

      <Panel
        title="Raid Parties"
        subtitle="Roster grouped by the in-game subgroup each player spent the most active time in."
        icon={<Users className="w-4 h-4" />}
        accent="text-theme-accent"
        action={`${partyGroups.length} groups`}
      >
        <div className="theme-party-grid grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {partyGroups.map(({ group, players }) => (
            <div key={group || "unknown"} className="theme-party-card rounded-xl p-3">
              <div className="mb-3 flex items-center justify-between border-b border-theme-border/50 pb-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-theme-muted">
                  {group > 0 ? `Party ${group}` : "Unassigned"}
                </div>
                <div className="rounded-md border border-theme-border/70 bg-theme-surface-elevated/80 px-2 py-0.5 text-[10px] font-mono text-theme-muted">
                  {players.length}
                </div>
              </div>
              <div className="space-y-2">
                {players.map((p) => {
                  const uptime = uptimeOf(p) * 100;
                  const mainProf = p.classTimes[0]?.profession ?? "Unknown";
                  const st = profStyle(mainProf);
                  return (
                    <div key={p.account} className="theme-roster-player rounded-lg p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[11px] font-semibold text-theme-text">{p.account}</div>
                          <div className="truncate text-[10px] text-theme-muted">{p.characterNames[0] ?? "No character name"}</div>
                        </div>
                        <PlayerClassChip profession={mainProf} />
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="theme-progress-track h-1.5 flex-1 overflow-hidden rounded-full">
                          <div className={`theme-progress-fill h-full rounded-full ${st.dot}`} style={{ width: `${Math.min(100, Math.max(0, uptime))}%` }} />
                        </div>
                        <span className="w-9 text-right font-mono text-[10px] font-bold text-theme-muted">{uptime.toFixed(0)}%</span>
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
      <Panel title="Roster Intel" icon={<Users className="w-4 h-4" />} accent="text-theme-accent" action={`${attendance.length} PLAYERS`} bodyClassName="p-0">
        <div className="theme-table-shell overflow-x-auto custom-scrollbar">
          <table className="theme-data-table w-full text-left text-xs">
            <thead>
              <tr className="theme-table-head text-[10px] uppercase font-bold tracking-wider">
                <SortableHeader label="Player" sortKey="account" state={sort} onSort={toggleSort} />
                <SortableHeader label="Characters" sortKey="characters" state={sort} onSort={toggleSort} />
                <SortableHeader label="Classes Played" sortKey="classes" state={sort} onSort={toggleSort} />
                <SortableHeader label="Combat Time" sortKey="combat" state={sort} onSort={toggleSort} align="right" />
                <SortableHeader label="Squad Time" sortKey="squad" state={sort} onSort={toggleSort} align="right" />
                <SortableHeader label="Uptime" sortKey="uptime" state={sort} onSort={toggleSort} className="w-32" />
              </tr>
            </thead>
            <tbody className="font-mono">
              {sorted.map((p) => {
                  const uptime = p.squadTimeMs > 0 ? (p.combatTimeMs / p.squadTimeMs) * 100 : 0;
                  const mainProf = p.classTimes[0]?.profession ?? "Unknown";
                  const st = profStyle(mainProf);
                  return (
                    <tr key={p.account} className="theme-table-row transition-colors">
                      <td className="p-2.5 text-theme-text font-semibold whitespace-nowrap">{p.account}</td>
                      <td className="p-2.5 text-theme-text/70">{p.characterNames.join(", ") || "-"}</td>
                      <td className="p-2.5">
                        <div className="flex flex-wrap gap-1">
                          {p.classTimes.slice(0, 3).map((c) => (
                            <PlayerClassChip key={c.profession} profession={c.profession} />
                          ))}
                          {p.classTimes.length > 3 && (
                            <span className="text-[10px] text-theme-muted">+{p.classTimes.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5 text-right text-theme-text/80">{fmtDur(p.combatTimeMs)}</td>
                      <td className="p-2.5 text-right text-theme-muted">{fmtDur(p.squadTimeMs)}</td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          <div className="theme-progress-track h-1.5 flex-1 rounded-full overflow-hidden">
                            <div
                              className={`theme-progress-fill h-full rounded-full transition-all duration-500 ${st.dot}`}
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
