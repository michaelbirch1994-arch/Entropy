import { useEffect, useRef, useState } from "react";
import { useReport } from "../store/ReportContext";
import { useView } from "../store/ViewContext";
import Panel from "../components/ui/Panel";
import StatCard from "../components/ui/StatCard";
import { fmtNum, fmtDur, profStyle, PROFESSION_FAMILY, normalizeProfessionLabel } from "../utils/format";
import { Users, Clock, Heart, Eye, ArrowDownRight } from "lucide-react";
import ProfessionIcon from "../components/ui/ProfessionIcon";
import ProfessionIdentity from "../components/ui/ProfessionIdentity";
import { SortableHeader } from "../components/ui/SortableHeader";

type SortKey = "account" | "characters" | "classes" | "combat" | "squad" | "uptime";
type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

export function RosterPartyMember({ account, character, profession, uptime, selected, onSelect }: {
  account: string;
  character: string;
  profession: string;
  uptime: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" className="entropy-roster-member"
      data-profession-family={PROFESSION_FAMILY[normalizeProfessionLabel(profession)] ?? "default"}
      data-selected={selected || undefined} aria-label={`View ${account} in Roster Intel`} onClick={onSelect}>
      <span className="entropy-roster-emblem" aria-hidden="true"><ProfessionIcon profession={profession} /></span>
      <span className="entropy-roster-identity"><strong>{account}</strong><span>{character}</span><small>{profession}</small></span>
      <span className="entropy-roster-uptime"><strong>{uptime.toFixed(0)}<small>%</small></strong><span>Uptime</span></span>
      <ArrowDownRight className="entropy-roster-open" size={15} aria-hidden="true" />
      <span className="entropy-roster-meter" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, uptime))}%` }} /></span>
    </button>
  );
}

export default function RosterView() {
  const { report } = useReport();
  const { navigationTarget, clearNavigationTarget } = useView();
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const selectedRowRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (!report || navigationTarget?.targetView !== "roster") return;
    const account = navigationTarget.account;
    setSelectedAccount(account && report.stats.attendanceData.some((player) => player.account === account) ? account : null);
    clearNavigationTarget();
  }, [report, navigationTarget, clearNavigationTarget]);
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: "center" });
    selectedRowRef.current?.focus({ preventScroll: true });
  }, [selectedAccount]);
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
    <div className="entropy-roster-report theme-view-layout space-y-5 animate-view pb-12">
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
        className="entropy-roster-parties"
      >
        <div className="entropy-party-grid">
          {partyGroups.map(({ group, players }) => (
            <section key={group || "unknown"} className="entropy-party-block" aria-label={group > 0 ? `Party ${group}` : "Unassigned"}>
              <header className="entropy-party-header">
                <span aria-hidden="true" className="entropy-party-number">{group > 0 ? String(group).padStart(2, "0") : "--"}</span>
                <h3>{group > 0 ? `Party ${group}` : "Unassigned"}</h3>
                <span className="entropy-party-count"><strong>{players.length}</strong> {players.length === 1 ? "player" : "players"}</span>
              </header>
              <div>
                {players.map((p) => {
                  const uptime = uptimeOf(p) * 100;
                  const mainProf = p.classTimes[0]?.profession ?? "Unknown";
                  return (
                    <RosterPartyMember key={p.account} account={p.account} character={p.characterNames[0] ?? "No character name"}
                      profession={mainProf} uptime={uptime} selected={selectedAccount === p.account}
                      onSelect={() => {
                        setSelectedAccount(p.account);
                        if (selectedAccount === p.account) {
                          selectedRowRef.current?.scrollIntoView({ block: "center" });
                          selectedRowRef.current?.focus({ preventScroll: true });
                        }
                      }} />
                  );
                })}
              </div>
            </section>
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
                    <tr key={p.account} ref={p.account === selectedAccount ? selectedRowRef : undefined}
                      tabIndex={p.account === selectedAccount ? -1 : undefined}
                      data-selected={p.account === selectedAccount || undefined}
                      className="theme-table-row transition-colors">
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
