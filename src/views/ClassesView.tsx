import { useMemo, useState } from "react";
import { useReport } from "../store/ReportContext";
import Panel from "../components/ui/Panel";
import { profStyle } from "../utils/format";
import type { ClassSlice } from "../types/report";
import { Activity, Layers, ShieldCheck, Swords, Users } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { TOOLTIP_STYLE, TOOLTIP_ITEM_STYLE } from "../utils/chartTheme";
import ClassIcon from "../components/ui/ClassIcon";
import BoundedDataRegion from "../components/ui/BoundedDataRegion";

type RoleSortKey = "account" | "profession" | "role" | "supportScore" | "confidenceScore";
type RoleSortState = { key: RoleSortKey; dir: "asc" | "desc" } | null;

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

export default function ClassesView() {
  const { report } = useReport();
  const [roleSort, setRoleSort] = useState<RoleSortState>(null);
  const [selectedProfession, setSelectedProfession] = useState<string | null>(null);
  const s = report?.stats;
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

  if (!report || !s) return null;
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
    <div className="space-y-5 animate-view pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Squad composition */}
        <Panel title="Squad Composition" icon={<Users className="w-4 h-4" />} accent="text-sky-400" action={`${squadTotal} slots`}>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-1/2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={s.squadClassData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
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

        {/* Enemy composition */}
        <Panel title="Enemy Composition" icon={<Layers className="w-4 h-4" />} accent="text-rose-400" action={`${enemyTotal} slots`}>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-1/2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={s.enemyClassData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
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
          <BoundedDataRegion
            label={`${selectedName ?? "Selected profession"} fight presence, ${fightPresence.length} fights`}
            itemCount={fightPresence.length}
            maxHeightClass="max-h-72"
            className="mt-4 grid gap-2 pr-1"
          >
            {fightPresence.map((fight) => (
              <div key={fight.label} className="grid grid-cols-[2.5rem_1fr_1.5rem] items-center gap-2 text-[10px]">
                <span className="font-mono text-slate-500">{fight.label}</span>
                <div className="h-2 bg-white/[0.05]"><div className={`h-full ${fight.isWin ? "bg-emerald-400" : "bg-orange-400"}`} style={{ width: `${(fight.count / maxFightPresence) * 100}%` }} /></div>
                <span className="text-right font-mono font-black text-slate-300">{fight.count}</span>
              </div>
            ))}
          </BoundedDataRegion>
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
    </div>
  );
}

function CoverageMetric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return <div className="theme-dossier-metric flex items-center justify-between border-l-2 border-orange-400/25 bg-black/30 px-4 py-3"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500">{icon}{label}</div><div className={`font-mono text-2xl font-black ${tone}`}>{value}</div></div>;
}
