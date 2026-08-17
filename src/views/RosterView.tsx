import { useMemo, useState } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import StatCard from "../components/ui/StatCard";
import { fmtNum, fmtDur, profChip, profStyle } from "../utils/format";
import type { ClassSlice } from "../types/report";
import { Users, Clock, Heart, Eye, Layers, Scale, Activity, ShieldCheck, Swords } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { TOOLTIP_STYLE, TOOLTIP_ITEM_STYLE } from "../utils/chartTheme";
import ClassIcon from "../components/ui/ClassIcon";
import ProfessionIcon from "../components/ui/ProfessionIcon";

// This view used to be three separate tabs (Roster Intel, Classes,
// Composition) that all answered overlapping questions about who's in the
// squad and who's on the other side. Consolidated here so "who are we, who
// did we fight, and who's actually pulling their weight" is one page
// instead of three with duplicated pie charts and tables.

type RosterSortKey = "account" | "characters" | "classes" | "combat" | "squad" | "uptime";
type RosterSortState = { key: RosterSortKey; dir: "asc" | "desc" } | null;
type RoleSortKey = "account" | "profession" | "role" | "supportScore" | "confidenceScore";
type RoleSortState = { key: RoleSortKey; dir: "asc" | "desc" } | null;
type DeltaSortKey = "name" | "squadCount" | "enemyCount" | "deltaPct";
type DeltaSortState = { key: DeltaSortKey; dir: "asc" | "desc" } | null;

function ClassList({ data, total, selected, onSelect }: { data: ClassSlice[]; total: number; selected: string | null; onSelect: (name: string) => void }) {
  return (
    <div className="space-y-2">
      {data.map((c) => {
        const pct = total > 0 ? (c.value / total) * 100 : 0;
        const s = profStyle(c.name);
        return (
          <button key={c.name} type="button" aria-pressed={selected === c.name} onClick={() => onSelect(c.name)} className={`flex w-full items-center gap-3 border-l-2 px-2 py-1 text-left transition ${selected === c.name ? "border-orange-400 bg-orange-500/[0.07]" : "border-transparent hover:border-slate-700 hover:bg-white/[0.02]"}`}>
            <div className={`h-6 w-6 rounded-md border ${s.border} ${s.bg} flex flex-shrink-0 items-center justify-center`}>
              <ClassIcon name={c.name} size="sm" />
            </div>
            <span className="text-xs font-semibold text-slate-300 w-28 flex-shrink-0">{c.name}</span>
            <div className="flex-1 h-5 bg-slate-800/40 rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500 flex items-center justify-end pr-2"
                style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: c.color }}
              >
                {pct > 10 && <span className="text-[10px] font-bold text-black/70">{c.value}</span>}
              </div>
            </div>
            <span className="text-xs font-mono text-slate-400 w-10 text-right">{c.value}</span>
            <span className="text-[10px] font-mono text-slate-500 w-12 text-right">{pct.toFixed(1)}%</span>
          </button>
        );
      })}
    </div>
  );
}

// Squad vs. Enemy delta - raw enemy counts alone don't say anything
// actionable. Comparing each class against the squad's own share answers
// the question that actually matters in WvW: which classes is the enemy
// running more/fewer of than us (e.g. "they have 3x our necros - expect
// heavy corrupts"). The delta bar makes the read instant instead of
// requiring you to compare two numbers per row.
function CompositionDeltaPanel({
  squadData,
  squadTotal,
  enemyData,
  enemyTotal,
}: {
  squadData: ClassSlice[];
  squadTotal: number;
  enemyData: ClassSlice[];
  enemyTotal: number;
}) {
  const [sort, setSort] = useState<DeltaSortState>(null);
  const squadByName = new Map(squadData.map((c) => [c.name, c.value]));
  const enemyByName = new Map(enemyData.map((c) => [c.name, c.value]));
  const names = Array.from(new Set([...squadByName.keys(), ...enemyByName.keys()]));

  const rows = useMemo(() => {
    const base = names
      .map((name) => {
        const squadCount = squadByName.get(name) || 0;
        const enemyCount = enemyByName.get(name) || 0;
        const squadPct = squadTotal > 0 ? (squadCount / squadTotal) * 100 : 0;
        const enemyPct = enemyTotal > 0 ? (enemyCount / enemyTotal) * 100 : 0;
        return { name, squadCount, enemyCount, deltaPct: enemyPct - squadPct };
      })
      .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct) || a.name.localeCompare(b.name));
    if (!sort) return base;
    const dir = sort.dir === "asc" ? 1 : -1;
    return base.sort((a, b) => {
      if (sort.key === "name") return a.name.localeCompare(b.name) * dir;
      return (a[sort.key] - b[sort.key]) * dir || a.name.localeCompare(b.name);
    });
  }, [enemyTotal, names, enemyByName, sort, squadByName, squadTotal]);

  const maxAbsDelta = Math.max(1, ...rows.map((r) => Math.abs(r.deltaPct)));

  const toggleSort = (key: DeltaSortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  };

  const sortLabel = (key: DeltaSortKey) => (!sort || sort.key !== key ? "SORT" : sort.dir === "desc" ? "DESC" : "ASC");

  const SortHeader = ({ label, k, align = "left" }: { label: string; k: DeltaSortKey; align?: "left" | "right" }) => (
    <th className={`p-2.5 ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors ${
          align === "right" ? "justify-end" : ""
        } ${sort?.key === k ? "text-amber-300" : "text-slate-500 hover:text-slate-300"}`}
      >
        {label} <span className="text-[8px] opacity-70">{sortLabel(k)}</span>
      </button>
    </th>
  );

  return (
    <Panel
      title="Squad vs. Enemy Composition"
      subtitle="Which classes the enemy is running more or less of than us, by share of each side's roster - the read that actually says something about what to expect."
      icon={<Scale className="w-4 h-4" />}
      accent="text-amber-400"
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/50">
              <SortHeader label="Class" k="name" />
              <SortHeader label="Squad" k="squadCount" align="right" />
              <SortHeader label="Enemy" k="enemyCount" align="right" />
              <th className="p-2.5">Delta (share)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/30 font-mono">
            {rows.map((r) => {
              const st = profStyle(r.name);
              const heavy = Math.abs(r.deltaPct) >= 5;
              const enemyHeavier = r.deltaPct > 0;
              const barWidthPct = (Math.abs(r.deltaPct) / maxAbsDelta) * 50;
              return (
                <tr key={r.name} className="hover:bg-blue-950/20 transition-colors">
                  <td className="p-2.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-sm ${st.dot} flex-shrink-0`} />
                      <span className="text-slate-200 font-semibold">{r.name}</span>
                    </div>
                  </td>
                  <td className="p-2.5 text-right text-sky-400">{fmtNum(r.squadCount)}</td>
                  <td className="p-2.5 text-right text-rose-400">{fmtNum(r.enemyCount)}</td>
                  <td className="p-2.5">
                    <div className="flex items-center gap-2">
                      {/* Diverging bar: squad-heavy grows left (sky), enemy-heavy grows right (rose), centered on a zero line. */}
                      <div className="relative flex h-4 flex-1 items-center">
                        <div className="absolute inset-y-0 left-1/2 w-px bg-slate-700" />
                        {!enemyHeavier && r.deltaPct !== 0 && (
                          <div
                            className="absolute right-1/2 h-2.5 rounded-l bg-sky-400/70"
                            style={{ width: `${barWidthPct}%` }}
                          />
                        )}
                        {enemyHeavier && (
                          <div
                            className="absolute left-1/2 h-2.5 rounded-r bg-rose-400/70"
                            style={{ width: `${barWidthPct}%` }}
                          />
                        )}
                      </div>
                      <span
                        className={`w-24 flex-shrink-0 text-right font-bold ${
                          !heavy ? "text-slate-500" : enemyHeavier ? "text-rose-400" : "text-sky-400"
                        }`}
                      >
                        {r.deltaPct > 0 ? "+" : ""}
                        {r.deltaPct.toFixed(1)}%
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
  );
}

function CoverageMetric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return <div className="theme-dossier-metric flex items-center justify-between border-l-2 border-orange-400/25 bg-black/30 px-4 py-3"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500">{icon}{label}</div><div className={`font-mono text-2xl font-black ${tone}`}>{value}</div></div>;
}

export default function RosterView() {
  const { report } = useReport();
  const s = report?.stats;

  const [rosterSort, setRosterSort] = useState<RosterSortState>(null);
  const [roleSort, setRoleSort] = useState<RoleSortState>(null);
  const [selectedProfession, setSelectedProfession] = useState<string | null>(null);

  // Hooks must run unconditionally (before the early return below), so
  // these read off `s?.` with fallbacks rather than the narrowed `s`.
  const roleRows = useMemo(() => {
    const base = [...(s?.roleClassifications ?? [])].sort((a, b) => a.account.localeCompare(b.account));
    if (!roleSort) return base;
    const dir = roleSort.dir === "asc" ? 1 : -1;
    return base.sort((a, b) => {
      if (roleSort.key === "account") return a.account.localeCompare(b.account) * dir;
      if (roleSort.key === "profession") return a.profession.localeCompare(b.profession) * dir || a.account.localeCompare(b.account);
      if (roleSort.key === "role") return a.role.localeCompare(b.role) * dir || a.account.localeCompare(b.account);
      return (a[roleSort.key] - b[roleSort.key]) * dir || a.account.localeCompare(b.account);
    });
  }, [s?.roleClassifications, roleSort]);

  if (!report || !s) return null;

  const attendance = s.attendanceData;
  const totalCombatMs = attendance.reduce((a, p) => a + p.combatTimeMs, 0);
  const avgCombatMs = attendance.length ? totalCombatMs / attendance.length : 0;
  const fullAtt = attendance.filter((p) => p.combatTimeMs / p.squadTimeMs > 0.9).length;
  const uptimeOf = (p: (typeof attendance)[number]) =>
    p.squadTimeMs > 0 ? p.combatTimeMs / p.squadTimeMs : 0;

  // Plain computation rather than useMemo: this sits after the `if (!report)`
  // early return, so a hook here would change hook order between renders.
  // A roster is tens of rows; re-sorting per render is free.
  const sortedRoster = (() => {
    const activeSort = rosterSort ?? { key: "combat" as const, dir: "desc" as const };
    const dir = activeSort.dir === "asc" ? 1 : -1;
    const cmp: Record<RosterSortKey, (a: typeof attendance[number], b: typeof attendance[number]) => number> = {
      account: (a, b) => a.account.localeCompare(b.account),
      characters: (a, b) => (a.characterNames[0] ?? "").localeCompare(b.characterNames[0] ?? ""),
      classes: (a, b) => (a.classTimes[0]?.profession ?? "").localeCompare(b.classTimes[0]?.profession ?? ""),
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

  const toggleRosterSort = (key: RosterSortKey) =>
    setRosterSort((prev) =>
      prev?.key === key
        ? prev.dir === "desc"
          ? { key, dir: "asc" }
          : null
        : { key, dir: key === "account" || key === "characters" || key === "classes" ? "asc" : "desc" },
    );

  const RosterSortHeader = ({ label, k, align = "left", width }: { label: string; k: RosterSortKey; align?: "left" | "right"; width?: string }) => (
    <th className={`p-2.5 ${align === "right" ? "text-right" : ""} ${width ?? ""}`}>
      <button
        type="button"
        onClick={() => toggleRosterSort(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-theme-text ${
          rosterSort?.key === k ? "text-theme-accent" : ""
        }`}
      >
        {label}
        <span className="text-[8px] opacity-70">{rosterSort?.key === k ? (rosterSort.dir === "asc" ? "ASC" : "DESC") : "SORT"}</span>
      </button>
    </th>
  );

  const PlayerClassChip = ({ profession }: { profession: string }) => (
    <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${profChip(profession)}`}>
      <ProfessionIcon profession={profession} className="h-3.5 w-3.5 shrink-0" />
      {profession}
    </span>
  );

  const toggleRoleSort = (key: RoleSortKey) => {
    setRoleSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  };

  const roleSortLabel = (key: RoleSortKey) => (!roleSort || roleSort.key !== key ? "SORT" : roleSort.dir === "desc" ? "DESC" : "ASC");

  const RoleSortHeader = ({ label, k, align = "left" }: { label: string; k: RoleSortKey; align?: "left" | "right" }) => (
    <th className={`px-2 py-2 ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => toggleRoleSort(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors ${
          align === "right" ? "justify-end" : ""
        } ${roleSort?.key === k ? "text-emerald-300" : "text-slate-500 hover:text-slate-300"}`}
      >
        {label} <span className="text-[8px] opacity-70">{roleSortLabel(k)}</span>
      </button>
    </th>
  );

  const squadTotal = s.squadClassData.reduce((a, c) => a + c.value, 0);
  const enemyTotal = s.enemyClassData.reduce((a, c) => a + c.value, 0);
  const selectedName = selectedProfession ?? s.squadClassData[0]?.name ?? s.enemyClassData[0]?.name ?? null;
  const selectedPlayers = selectedName ? roleRows.filter((row) => row.profession === selectedName || row.professionList?.includes(selectedName)) : [];
  const selectedSquadCount = s.squadClassData.find((row) => row.name === selectedName)?.value ?? 0;
  const selectedEnemyCount = s.enemyClassData.find((row) => row.name === selectedName)?.value ?? 0;
  const fightPresence = selectedName ? s.fightBreakdown.map((fight, index) => ({
    label: fight.label || `F${index + 1}`,
    count: fight.squadClassCountsFight?.[selectedName] ?? 0,
    isWin: fight.isWin,
  })) : [];
  const maxFightPresence = Math.max(1, ...fightPresence.map((fight) => fight.count));
  const supportCount = (s.roleClassifications ?? []).filter((row) => row.role === "support").length;
  const damageCount = (s.roleClassifications ?? []).filter((row) => row.role === "damage").length;
  const highConfidenceCount = (s.roleClassifications ?? []).filter((row) => row.confidenceScore >= 0.75).length;

  return (
    <div className="theme-view-layout space-y-5 animate-view pb-12">
      {/* Summary */}
      <div className="theme-stat-grid grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Roster Size" value={fmtNum(attendance.length)} icon={<Users className="w-3.5 h-3.5 text-theme-accent" />} accent="text-theme-accent" />
        <StatCard label="Avg Combat Time" value={fmtDur(avgCombatMs)} icon={<Clock className="w-3.5 h-3.5 text-emerald-400" />} accent="text-emerald-400" />
        <StatCard label="Full Attendance" value={fullAtt} icon={<Heart className="w-3.5 h-3.5 text-rose-400" />} accent="text-rose-400" sub=">90% combat uptime" />
        <StatCard label="Total Fights" value={fmtNum(s.total)} icon={<Eye className="w-3.5 h-3.5 text-cyan-400" />} accent="text-cyan-400" />
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

      {/* Squad vs enemy composition */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Squad Composition" icon={<Users className="w-4 h-4" />} accent="text-sky-400" action={`${squadTotal} slots`}>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-1/2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={s.squadClassData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {s.squadClassData.map((c) => (
                      <Cell key={c.name} fill={c.color} stroke="#0a101f" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2">
              <ClassList data={s.squadClassData} total={squadTotal} selected={selectedName} onSelect={setSelectedProfession} />
            </div>
          </div>
        </Panel>

        <Panel title="Enemy Composition" icon={<Layers className="w-4 h-4" />} accent="text-rose-400" action={`${enemyTotal} slots`}>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-1/2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={s.enemyClassData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {s.enemyClassData.map((c) => (
                      <Cell key={c.name} fill={c.color} stroke="#0a101f" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2">
              <ClassList data={s.enemyClassData} total={enemyTotal} selected={selectedName} onSelect={setSelectedProfession} />
            </div>
          </div>
        </Panel>
      </div>

      <CompositionDeltaPanel squadData={s.squadClassData} squadTotal={squadTotal} enemyData={s.enemyClassData} enemyTotal={enemyTotal} />

      {/* Profession dossier */}
      <section className="theme-class-dossier grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="theme-selected-fight border border-orange-400/20 bg-black/40 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-300">Profession dossier</div>
              <h3 className="mt-1 text-xl font-black uppercase text-slate-100">{selectedName ?? "No profession selected"}</h3>
              <p className="mt-2 text-xs text-slate-500">Select any profession in either composition list to inspect roster roles and fight presence.</p>
            </div>
            <div className="flex gap-2 text-center">
              <div className="border-l-2 border-sky-400/40 bg-black/25 px-4 py-2"><div className="font-mono text-xl font-black text-sky-300">{selectedSquadCount}</div><div className="text-[9px] uppercase text-slate-500">squad</div></div>
              <div className="border-l-2 border-rose-400/40 bg-black/25 px-4 py-2"><div className="font-mono text-xl font-black text-rose-300">{selectedEnemyCount}</div><div className="text-[9px] uppercase text-slate-500">enemy</div></div>
            </div>
          </div>
          <div className="mt-5 grid gap-2 md:grid-cols-2">
            {selectedPlayers.length ? selectedPlayers.map((player) => (
              <div key={player.account} className="theme-roster-strip grid grid-cols-[1fr_auto] gap-3 border border-white/[0.06] bg-black/25 px-3 py-2">
                <div><div className="truncate text-xs font-bold text-slate-200">{player.account}</div><div className="mt-1 text-[10px] uppercase text-slate-500">{player.role} · {player.factors.slice(0, 2).map((factor) => factor.metric).join(", ") || "classification evidence unavailable"}</div></div>
                <div className="font-mono text-xs font-black text-amber-300">{Math.round(player.confidenceScore * 100)}%</div>
              </div>
            )) : <div className="border-l-2 border-slate-700 px-3 py-2 text-xs text-slate-500">No classified squad player is attached to this profession.</div>}
          </div>
        </div>

        <div className="theme-comparison-slab border border-cyan-400/15 bg-black/35 p-5">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300"><Activity className="h-4 w-4" /> Fight presence</div>
          <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto pr-1 custom-scrollbar">
            {fightPresence.map((fight) => (
              <div key={fight.label} className="grid grid-cols-[2.5rem_1fr_1.5rem] items-center gap-2 text-[10px]">
                <span className="font-mono text-slate-500">{fight.label}</span>
                <div className="h-2 bg-white/[0.05]"><div className={`h-full ${fight.isWin ? "bg-emerald-400" : "bg-orange-400"}`} style={{ width: `${(fight.count / maxFightPresence) * 100}%` }} /></div>
                <span className="text-right font-mono font-black text-slate-300">{fight.count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="theme-role-coverage grid gap-3 sm:grid-cols-3">
        <CoverageMetric icon={<ShieldCheck className="h-4 w-4" />} label="Support classifications" value={supportCount} tone="text-emerald-300" />
        <CoverageMetric icon={<Swords className="h-4 w-4" />} label="Damage classifications" value={damageCount} tone="text-orange-300" />
        <CoverageMetric icon={<Users className="h-4 w-4" />} label="High-confidence roles" value={highConfidenceCount} tone="text-cyan-300" />
      </section>

      {/* Role classifications */}
      <Panel title="Role Classifications" icon={<Users className="w-4 h-4" />} accent="text-emerald-400">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-800/50">
                <RoleSortHeader label="Player" k="account" />
                <RoleSortHeader label="Class" k="profession" />
                <RoleSortHeader label="Role" k="role" />
                <RoleSortHeader label="Score" k="supportScore" align="right" />
                <RoleSortHeader label="Confidence" k="confidenceScore" align="right" />
                <th className="px-2 py-2">Key Factors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30 font-mono">
              {roleRows.slice(0, 20).map((r) => {
                const roleColor =
                  r.role === "support" ? "text-emerald-400 bg-emerald-950/40 border-emerald-500/30"
                  : r.role === "damage" ? "text-orange-400 bg-orange-950/40 border-orange-500/30"
                  : "text-slate-400 bg-slate-800/40 border-slate-600/30";
                return (
                  <tr key={r.account} className="hover:bg-blue-950/20 transition-colors">
                    <td className="px-2 py-2 text-slate-200 font-semibold">{r.account}</td>
                    <td className="px-2 py-2 text-slate-400">{r.profession}</td>
                    <td className="px-2 py-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${roleColor} uppercase`}>
                        {r.role}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right text-slate-300">{r.supportScore.toFixed(1)}</td>
                    <td className="px-2 py-2 text-right text-slate-500">{(r.confidenceScore * 100).toFixed(0)}%</td>
                    <td className="px-2 py-2 text-[10px] text-slate-500">
                      {r.factors.slice(0, 2).map((f) => f.metric).join(", ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Roster table */}
      <Panel title="Roster Intel" icon={<Users className="w-4 h-4" />} accent="text-theme-accent" action={`${attendance.length} PLAYERS`} bodyClassName="p-0">
        <div className="theme-table-shell overflow-x-auto custom-scrollbar">
          <table className="theme-data-table w-full text-left text-xs">
            <thead>
              <tr className="theme-table-head text-[10px] uppercase font-bold tracking-wider">
                <RosterSortHeader label="Player" k="account" />
                <RosterSortHeader label="Characters" k="characters" />
                <RosterSortHeader label="Classes Played" k="classes" />
                <RosterSortHeader label="Combat Time" k="combat" align="right" />
                <RosterSortHeader label="Squad Time" k="squad" align="right" />
                <RosterSortHeader label="Uptime" k="uptime" width="w-32" />
              </tr>
            </thead>
            <tbody className="font-mono">
              {sortedRoster.map((p) => {
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
